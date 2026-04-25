/**
 * CHENGETO Health - Check-In Page
 * Perform and manage patient check-ins
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Button,
  LinearProgress,
  Avatar,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Switch,
} from '@mui/material';
import {
  CheckCircle,
  Nfc,
  Bluetooth,
  LocationOn,
  Schedule,
  Person,
  Search,
  ArrowForward,
  ArrowBack,
  Save,
  Favorite,
  Mood,
  Medication,
  Restaurant,
  Accessibility,
  Home,
  Add,
  Remove,
  Refresh,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { api } from '../../contexts/AuthContext';
import { getElderlyNcdMonitoringSummary } from '../../constants/elderlyNcdProfiles';
import { format } from 'date-fns';

const steps = ['Select Patient', 'Verification', 'Vitals', 'Wellness', 'Complete'];

const buildMedicationEntryDraft = (medication) => ({
  name: medication.name,
  dosage: medication.dosage || '',
  dueTime: medication.scheduledTime || '',
  dueToday: Boolean(medication.dueToday),
  status: medication.todayStatus || (medication.dueToday ? 'taken' : 'not_due'),
  notes: '',
  missedReason: medication.recentMissReason || '',
  sideEffectsText: (medication.recentSideEffects || []).join(', '),
  refillConcern: Boolean(medication.refillConcern),
  reminderId: medication.reminderId || '',
});

const normalizeFunctionalMobilityValue = (value) => {
  switch (value) {
    case 'normal':
      return 'independent';
    case 'limited':
    case 'needs_assistance':
      return 'assisted';
    case 'bedridden':
      return 'bedbound';
    default:
      return value || 'independent';
  }
};

const buildFunctionalAssessmentDraft = (patient) => {
  const baseline = patient?.functionalBaseline || {};

  return {
    changedSinceLastVisit: false,
    changeNotes: '',
    gait: baseline.gait || 'steady',
    balance: baseline.balance || 'stable',
    assistiveDevice: baseline.assistiveDevice || 'none',
    frailty: baseline.frailty || 'robust',
    walkingDifficulty: 'none',
    visionConcern: false,
    hearingConcern: false,
    continenceConcern: false,
    confusionChange: false,
    appetiteConcern: false,
    weightConcern: false,
    homeSafetyConcern: false,
    recentFall: false,
    nearFall: false,
    fallInjury: false,
    fearOfFalling: false,
    frailtySignsText: '',
  };
};

const CheckInPage = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [medicationPlan, setMedicationPlan] = useState({ medications: [], summary: {} });

  // Verification
  const [verificationMethod, setVerificationMethod] = useState('manual');
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  // Check-in data
  const [checkInData, setCheckInData] = useState({
    vitals: {
      heartRate: '',
      systolic: '',
      diastolic: '',
      temperature: '',
      spo2: '',
      bloodGlucose: '',
      respiratoryRate: '',
      weight: '',
      rhythmIrregularity: false,
    },
    wellness: {
      overallFeeling: 5,
      painLevel: 0,
      appetite: 'normal',
      mobility: 'independent',
      sleepQuality: 'normal',
      mood: 'normal',
    },
    medications: {
      entries: [],
      notes: '',
      refillConcern: false,
    },
    functionalAssessment: buildFunctionalAssessmentDraft(),
    notes: '',
    observations: [],
  });

  // Observation checkboxes
  const [observations, setObservations] = useState([]);
  const selectedMonitoringSummary = getElderlyNcdMonitoringSummary(selectedPatient?.ncdConditions || []);

  useEffect(() => {
    fetchPatients();
    requestLocation();

    // Listen for BLE/NFC scans
    if (socket) {
      socket.on('ble:device:found', handleBLEDevice);
      socket.on('nfc:tag:detected', handleNFCTag);
    }

    return () => {
      if (socket) {
        socket.off('ble:device:found');
        socket.off('nfc:tag:detected');
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedPatient?._id) {
      setMedicationPlan({ medications: [], summary: {} });
      setCheckInData((prev) => ({
        ...prev,
        medications: {
          entries: [],
          notes: '',
          refillConcern: false,
        },
        functionalAssessment: buildFunctionalAssessmentDraft(),
      }));
      return;
    }

    setCheckInData((prev) => ({
      ...prev,
      wellness: {
        ...prev.wellness,
        mobility: normalizeFunctionalMobilityValue(
          selectedPatient?.functionalBaseline?.mobility || selectedPatient?.mobilityStatus
        ),
      },
      functionalAssessment: buildFunctionalAssessmentDraft(selectedPatient),
    }));
    loadMedicationPlan(selectedPatient._id);
  }, [selectedPatient?._id]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/patients?limit=100');
      const nextPatients = (response.data?.data?.patients || []).map((patient) => ({
        ...patient,
        medicalId: patient.patientId,
        careLevel: patient.riskLevel,
        location: patient.address?.coordinates
          ? {
              coordinates: [
                patient.address.coordinates.longitude,
                patient.address.coordinates.latitude
              ]
            }
          : null,
        devices: patient.iotDevice?.deviceId
          ? [{ deviceId: patient.iotDevice.deviceId }]
          : [],
      }));

      setPatients(nextPatients);
    } catch (error) {
      console.error('Failed to fetch patients:', error);
      enqueueSnackbar('Failed to load patients', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          console.error('Location error:', error);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleBLEDevice = (device) => {
    // Find patient by device ID
    const patient = patients.find(p =>
      p.devices?.some(d => d.deviceId === device.deviceId)
    );

    if (patient) {
      setSelectedPatient(patient);
      setVerificationMethod('ble');
      setVerificationStatus('verified');
      enqueueSnackbar(`BLE device verified for ${patient.firstName}`, { variant: 'success' });
      setIsScanning(false);
    }
  };

  const handleNFCTag = (tag) => {
    // Find patient by NFC tag ID
    const patient = patients.find(p =>
      p.nfcTagId === tag.id || p.devices?.some(d => d.nfcTagId === tag.id)
    );

    if (patient) {
      setSelectedPatient(patient);
      setVerificationMethod('nfc');
      setVerificationStatus('verified');
      enqueueSnackbar(`NFC tag verified for ${patient.firstName}`, { variant: 'success' });
      setIsScanning(false);
    }
  };

  const handleStartScan = async (method) => {
    setIsScanning(true);
    setVerificationMethod(method);
    setVerificationStatus(null);

    try {
      if (method === 'ble') {
        // Request BLE scan
        socket?.emit('ble:startScan');
      } else if (method === 'nfc') {
        // Request NFC scan
        socket?.emit('nfc:startScan');
      }
    } catch (error) {
      enqueueSnackbar('Failed to start scanning', { variant: 'error' });
      setIsScanning(false);
    }
  };

  const handleManualSelect = (patient) => {
    setSelectedPatient(patient);
    setVerificationMethod('manual');
    setVerificationStatus('pending');
  };

  const loadMedicationPlan = async (patientId) => {
    try {
      const response = await api.get(`/patients/${patientId}/medications`);
      const snapshot = response.data?.data || response.data || { medications: [], summary: {} };
      const medications = Array.isArray(snapshot.medications) ? snapshot.medications : [];

      setMedicationPlan({
        medications,
        summary: snapshot.summary || {},
      });
      setCheckInData((prev) => ({
        ...prev,
        medications: {
          entries: medications.map(buildMedicationEntryDraft),
          notes: '',
          refillConcern: (snapshot.summary?.refillRisks || 0) > 0,
        },
      }));
    } catch (error) {
      console.error('Failed to load medication plan:', error);
      setMedicationPlan({ medications: [], summary: {} });
      enqueueSnackbar('Failed to load medication schedule', { variant: 'error' });
    }
  };

  const handleVerifyLocation = async () => {
    if (!currentLocation || !selectedPatient?.location?.coordinates) {
      setVerificationStatus('verified');
      return;
    }

    // Calculate distance
    const [patientLng, patientLat] = selectedPatient.location.coordinates;
    const distance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      patientLat,
      patientLng
    );

    if (distance < 100) { // Within 100 meters
      setVerificationStatus('verified');
      enqueueSnackbar('Location verified', { variant: 'success' });
    } else {
      setVerificationStatus('verified'); // Allow to proceed with warning
      enqueueSnackbar('Warning: Location does not match patient address', { variant: 'warning' });
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const handleVitalChange = (field, value) => {
    setCheckInData(prev => ({
      ...prev,
      vitals: {
        ...prev.vitals,
        [field]: value,
      },
    }));
  };

  const handleWellnessChange = (field, value) => {
    setCheckInData(prev => ({
      ...prev,
      wellness: {
        ...prev.wellness,
        [field]: value,
      },
    }));
  };

  const handleObservationToggle = (observation) => {
    setObservations(prev =>
      prev.includes(observation)
        ? prev.filter(o => o !== observation)
        : [...prev, observation]
    );
  };

  const handleMedicationEntryChange = (index, field, value) => {
    setCheckInData((prev) => ({
      ...prev,
      medications: {
        ...prev.medications,
        entries: prev.medications.entries.map((entry, entryIndex) => (
          entryIndex === index
            ? {
                ...entry,
                [field]: value,
              }
            : entry
        )),
      },
    }));
  };

  const handleFunctionalAssessmentChange = (field, value) => {
    setCheckInData((prev) => ({
      ...prev,
      functionalAssessment: {
        ...prev.functionalAssessment,
        [field]: value,
      },
    }));
  };

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const payload = {
        patientId: selectedPatient._id,
        method: verificationMethod === 'manual' ? 'manual_override' : verificationMethod,
        location: currentLocation
          ? {
              latitude: currentLocation.lat,
              longitude: currentLocation.lng,
              accuracy: currentLocation.accuracy,
            }
          : undefined,
        notes: checkInData.notes,
        observations,
        wellnessScore: checkInData.wellness.overallFeeling,
        mood: checkInData.wellness.mood,
        mobility: checkInData.wellness.mobility,
        functionalAssessment: {
          ...checkInData.functionalAssessment,
          mobility: checkInData.wellness.mobility,
          frailtySigns: checkInData.functionalAssessment.frailtySignsText
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        },
        medications: {
          notes: checkInData.medications.notes,
          refillConcern:
            Boolean(checkInData.medications.refillConcern) ||
            checkInData.medications.entries.some((entry) => entry.refillConcern),
          entries: checkInData.medications.entries.map((entry) => ({
            reminderId: entry.reminderId || undefined,
            name: entry.name,
            dosage: entry.dosage,
            dueTime: entry.dueTime,
            dueToday: entry.dueToday,
            status: entry.status,
            notes: entry.notes,
            missedReason: entry.missedReason,
            sideEffects: entry.sideEffectsText
              .split(',')
              .map((sideEffect) => sideEffect.trim())
              .filter(Boolean),
            refillConcern: Boolean(entry.refillConcern),
            confirmationSource: 'caregiver',
          })),
        },
        vitals: {
          ...checkInData.vitals,
          heartRate: parseFloat(checkInData.vitals.heartRate) || null,
          systolic: parseFloat(checkInData.vitals.systolic) || null,
          diastolic: parseFloat(checkInData.vitals.diastolic) || null,
          temperature: parseFloat(checkInData.vitals.temperature) || null,
          spo2: parseFloat(checkInData.vitals.spo2) || null,
          bloodGlucose: parseFloat(checkInData.vitals.bloodGlucose) || null,
          respiratoryRate: parseFloat(checkInData.vitals.respiratoryRate) || null,
          weight: parseFloat(checkInData.vitals.weight) || null,
          rhythmIrregularity: Boolean(checkInData.vitals.rhythmIrregularity),
        },
      };

      await api.post('/checkins/manual', payload);

      enqueueSnackbar('Check-in completed successfully', { variant: 'success' });
      navigate('/checkin/history');
    } catch (error) {
      console.error('Failed to submit check-in:', error);
      enqueueSnackbar('Failed to submit check-in', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <TextField
              fullWidth
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
              }}
              sx={{ mb: 3 }}
            />

            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Your Assigned Patients
            </Typography>

            <List>
              {patients
                .filter(p =>
                  `${p.firstName} ${p.lastName} ${p.medicalId}`
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())
                )
                .map((patient) => (
                  <React.Fragment key={patient._id}>
                    <ListItem
                      selected={selectedPatient?._id === patient._id}
                      onClick={() => handleManualSelect(patient)}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar>
                          {patient.firstName?.[0]}{patient.lastName?.[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`${patient.firstName} ${patient.lastName}`}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              ID: {patient.medicalId}
                            </Typography>
                            <Chip
                              size="small"
                              label={patient.careLevel}
                              sx={{ mt: 0.5 }}
                            />
                          </Box>
                        }
                      />
                      {selectedPatient?._id === patient._id && (
                        <CheckCircle color="primary" />
                      )}
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
            </List>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Verify your presence with the patient using one of the available methods.
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: verificationMethod === 'ble' ? 2 : 0,
                    borderColor: 'primary.main',
                  }}
                  onClick={() => handleStartScan('ble')}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <Bluetooth sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Bluetooth (BLE)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Scan for nearby BLE devices
                    </Typography>
                  </Box>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: verificationMethod === 'nfc' ? 2 : 0,
                    borderColor: 'primary.main',
                  }}
                  onClick={() => handleStartScan('nfc')}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <Nfc sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                    <Typography variant="subtitle1" fontWeight={600}>
                      NFC Tag
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Tap NFC tag to verify
                    </Typography>
                  </Box>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: verificationMethod === 'manual' ? 2 : 0,
                    borderColor: 'primary.main',
                  }}
                  onClick={handleVerifyLocation}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <LocationOn sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                    <Typography variant="subtitle1" fontWeight={600}>
                      Manual + GPS
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Verify with location check
                    </Typography>
                  </Box>
                </Card>
              </Grid>
            </Grid>

            {isScanning && (
              <Box sx={{ textAlign: 'center', mt: 3 }}>
                <LinearProgress sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Scanning for {verificationMethod === 'ble' ? 'Bluetooth devices' : 'NFC tags'}...
                </Typography>
              </Box>
            )}

            {verificationStatus === 'verified' && (
              <Alert severity="success" sx={{ mt: 3 }} icon={<CheckCircle />}>
                Verification successful! You can proceed to the next step.
              </Alert>
            )}

            {currentLocation && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Your location: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                  (Accuracy: {currentLocation.accuracy?.toFixed(0)}m)
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Record Vital Signs
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter the patient&apos;s vital signs. Leave blank if not measured.
            </Typography>

            {selectedPatient?.ncdConditions?.length > 0 && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Condition-aware monitoring for {selectedPatient.firstName}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Recommended inputs: {selectedMonitoringSummary.signalLabels.join(', ')}
                </Typography>
                <Typography variant="body2">
                  {selectedMonitoringSummary.notes[0]}
                </Typography>
              </Alert>
            )}

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Heart Rate"
                  type="number"
                  value={checkInData.vitals.heartRate}
                  onChange={(e) => handleVitalChange('heartRate', e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">bpm</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    label="Systolic"
                    type="number"
                    value={checkInData.vitals.systolic}
                    onChange={(e) => handleVitalChange('systolic', e.target.value)}
                  />
                  <Typography sx={{ alignSelf: 'center' }}>/</Typography>
                  <TextField
                    fullWidth
                    label="Diastolic"
                    type="number"
                    value={checkInData.vitals.diastolic}
                    onChange={(e) => handleVitalChange('diastolic', e.target.value)}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Temperature"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  value={checkInData.vitals.temperature}
                    onChange={(e) => handleVitalChange('temperature', e.target.value)}
                    InputProps={{
                    endAdornment: <InputAdornment position="end">deg C</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="SpO2"
                  type="number"
                  value={checkInData.vitals.spo2}
                  onChange={(e) => handleVitalChange('spo2', e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Blood Glucose"
                  type="number"
                  value={checkInData.vitals.bloodGlucose}
                  onChange={(e) => handleVitalChange('bloodGlucose', e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">mg/dL</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Respiratory Rate"
                  type="number"
                  value={checkInData.vitals.respiratoryRate}
                  onChange={(e) => handleVitalChange('respiratoryRate', e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">breaths/min</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Weight"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  value={checkInData.vitals.weight}
                  onChange={(e) => handleVitalChange('weight', e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kg</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(checkInData.vitals.rhythmIrregularity)}
                      onChange={(e) => handleVitalChange('rhythmIrregularity', e.target.checked)}
                    />
                  }
                  label="Irregular pulse or wearable rhythm flag detected"
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Wellness Assessment
            </Typography>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="body2" gutterBottom>
                  Overall Feeling (1-10)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Mood color="error" />
                  <Slider
                    value={checkInData.wellness.overallFeeling}
                    onChange={(e, v) => handleWellnessChange('overallFeeling', v)}
                    min={1}
                    max={10}
                    marks
                    valueLabelDisplay="on"
                    sx={{ flex: 1 }}
                  />
                  <Mood color="success" />
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="body2" gutterBottom>
                  Pain Level (0-10)
                </Typography>
                <Slider
                  value={checkInData.wellness.painLevel}
                  onChange={(e, v) => handleWellnessChange('painLevel', v)}
                  min={0}
                  max={10}
                  marks
                  valueLabelDisplay="on"
                />
              </CardContent>
            </Card>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Appetite</InputLabel>
                  <Select
                    value={checkInData.wellness.appetite}
                    onChange={(e) => handleWellnessChange('appetite', e.target.value)}
                    label="Appetite"
                  >
                    <MenuItem value="good">Good</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="poor">Poor</MenuItem>
                    <MenuItem value="none">No appetite</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Mobility</InputLabel>
                  <Select
                    value={checkInData.wellness.mobility}
                    onChange={(e) => handleWellnessChange('mobility', e.target.value)}
                    label="Mobility"
                  >
                    <MenuItem value="independent">Independent</MenuItem>
                    <MenuItem value="assisted">Needs Assistance</MenuItem>
                    <MenuItem value="wheelchair">Wheelchair</MenuItem>
                    <MenuItem value="bedbound">Bedbound</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Sleep Quality</InputLabel>
                  <Select
                    value={checkInData.wellness.sleepQuality}
                    onChange={(e) => handleWellnessChange('sleepQuality', e.target.value)}
                    label="Sleep Quality"
                  >
                    <MenuItem value="good">Good</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="disturbed">Disturbed</MenuItem>
                    <MenuItem value="insomnia">Insomnia</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Mood</InputLabel>
                  <Select
                    value={checkInData.wellness.mood}
                    onChange={(e) => handleWellnessChange('mood', e.target.value)}
                    label="Mood"
                  >
                    <MenuItem value="happy">Happy</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="anxious">Anxious</MenuItem>
                    <MenuItem value="depressed">Depressed</MenuItem>
                    <MenuItem value="agitated">Agitated</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Fall Risk and Functional Decline
              </Typography>

              {(selectedPatient?.functionalBaseline?.mobility ||
                selectedPatient?.functionalBaseline?.gait ||
                selectedPatient?.functionalBaseline?.balance ||
                selectedPatient?.functionalBaseline?.assistiveDevice) && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Baseline: {[
                    selectedPatient?.functionalBaseline?.mobility ? `Mobility ${selectedPatient.functionalBaseline.mobility}` : null,
                    selectedPatient?.functionalBaseline?.gait ? `Gait ${selectedPatient.functionalBaseline.gait}` : null,
                    selectedPatient?.functionalBaseline?.balance ? `Balance ${selectedPatient.functionalBaseline.balance}` : null,
                    selectedPatient?.functionalBaseline?.assistiveDevice && selectedPatient.functionalBaseline.assistiveDevice !== 'none'
                      ? `Device ${selectedPatient.functionalBaseline.assistiveDevice}`
                      : null,
                  ].filter(Boolean).join(' | ')}
                </Alert>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(checkInData.functionalAssessment.changedSinceLastVisit)}
                        onChange={(e) => handleFunctionalAssessmentChange('changedSinceLastVisit', e.target.checked)}
                      />
                    }
                    label="Function has changed since the last visit"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Gait</InputLabel>
                    <Select
                      value={checkInData.functionalAssessment.gait}
                      onChange={(e) => handleFunctionalAssessmentChange('gait', e.target.value)}
                      label="Gait"
                    >
                      <MenuItem value="steady">Steady</MenuItem>
                      <MenuItem value="slow">Slow</MenuItem>
                      <MenuItem value="shuffling">Shuffling</MenuItem>
                      <MenuItem value="unsteady">Unsteady</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Balance</InputLabel>
                    <Select
                      value={checkInData.functionalAssessment.balance}
                      onChange={(e) => handleFunctionalAssessmentChange('balance', e.target.value)}
                      label="Balance"
                    >
                      <MenuItem value="stable">Stable</MenuItem>
                      <MenuItem value="needs_support">Needs support</MenuItem>
                      <MenuItem value="unstable">Unstable</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Assistive Device</InputLabel>
                    <Select
                      value={checkInData.functionalAssessment.assistiveDevice}
                      onChange={(e) => handleFunctionalAssessmentChange('assistiveDevice', e.target.value)}
                      label="Assistive Device"
                    >
                      <MenuItem value="none">None</MenuItem>
                      <MenuItem value="cane">Cane</MenuItem>
                      <MenuItem value="walker">Walker</MenuItem>
                      <MenuItem value="wheelchair">Wheelchair</MenuItem>
                      <MenuItem value="bed_rail">Bed rail</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Walking Difficulty</InputLabel>
                    <Select
                      value={checkInData.functionalAssessment.walkingDifficulty}
                      onChange={(e) => handleFunctionalAssessmentChange('walkingDifficulty', e.target.value)}
                      label="Walking Difficulty"
                    >
                      <MenuItem value="none">None</MenuItem>
                      <MenuItem value="mild">Mild</MenuItem>
                      <MenuItem value="moderate">Moderate</MenuItem>
                      <MenuItem value="severe">Severe</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Frailty</InputLabel>
                    <Select
                      value={checkInData.functionalAssessment.frailty}
                      onChange={(e) => handleFunctionalAssessmentChange('frailty', e.target.value)}
                      label="Frailty"
                    >
                      <MenuItem value="robust">Robust</MenuItem>
                      <MenuItem value="pre_frail">Pre-frail</MenuItem>
                      <MenuItem value="frail">Frail</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Change Notes"
                    value={checkInData.functionalAssessment.changeNotes}
                    onChange={(e) => handleFunctionalAssessmentChange('changeNotes', e.target.value)}
                    placeholder="Walking slower, more short of breath, more confusion, weaker transfers..."
                  />
                </Grid>
              </Grid>

              <Grid container spacing={1} sx={{ mt: 1 }}>
                {[
                  ['recentFall', 'Recent fall reported'],
                  ['nearFall', 'Near fall or slip'],
                  ['fallInjury', 'Possible injury from fall'],
                  ['fearOfFalling', 'Fear of falling'],
                  ['visionConcern', 'Vision concern'],
                  ['hearingConcern', 'Hearing concern'],
                  ['continenceConcern', 'Continence concern'],
                  ['confusionChange', 'Confusion or cognitive change'],
                  ['appetiteConcern', 'Appetite decline'],
                  ['weightConcern', 'Weight loss concern'],
                  ['homeSafetyConcern', 'Home safety concern'],
                ].map(([field, label]) => (
                  <Grid item xs={12} sm={6} md={4} key={field}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(checkInData.functionalAssessment[field])}
                          onChange={(e) => handleFunctionalAssessmentChange(field, e.target.checked)}
                        />
                      }
                      label={label}
                    />
                  </Grid>
                ))}
              </Grid>

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Frailty or decline signs"
                value={checkInData.functionalAssessment.frailtySignsText}
                onChange={(e) => handleFunctionalAssessmentChange('frailtySignsText', e.target.value)}
                placeholder="Weight loss, exhaustion, slower walking, weaker grip"
                sx={{ mt: 2 }}
              />
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Medication Adherence
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Confirm each scheduled medication, record missed doses, and note any side effects or refill concerns.
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip label={`Active: ${medicationPlan.summary?.totalActive || 0}`} size="small" />
                <Chip label={`Due today: ${medicationPlan.summary?.dueToday || 0}`} size="small" color="info" />
                <Chip label={`Refill risks: ${medicationPlan.summary?.refillRisks || 0}`} size="small" color={(medicationPlan.summary?.refillRisks || 0) > 0 ? 'warning' : 'default'} />
              </Box>

              {checkInData.medications.entries.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No medication plan is recorded for this patient yet.
                </Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {checkInData.medications.entries.map((entry, index) => (
                    <Paper key={`${entry.name}-${entry.dueTime || index}`} variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {entry.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {[entry.dosage, entry.dueTime ? `Due ${entry.dueTime}` : null].filter(Boolean).join(' | ') || 'No dose details'}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          color={entry.dueToday ? 'primary' : 'default'}
                          label={entry.dueToday ? 'Due today' : 'Not due today'}
                        />
                      </Box>

                      <FormControl component="fieldset" sx={{ mb: 2 }}>
                        <FormLabel component="legend">Dose status</FormLabel>
                        <RadioGroup
                          row
                          value={entry.status}
                          onChange={(e) => handleMedicationEntryChange(index, 'status', e.target.value)}
                        >
                          <FormControlLabel value="taken" control={<Radio />} label="Taken" />
                          <FormControlLabel value="missed" control={<Radio />} label="Missed" />
                          <FormControlLabel value="not_due" control={<Radio />} label="Not due" />
                        </RadioGroup>
                      </FormControl>

                      {entry.status === 'missed' && (
                        <TextField
                          fullWidth
                          label="Missed-dose reason"
                          value={entry.missedReason}
                          onChange={(e) => handleMedicationEntryChange(index, 'missedReason', e.target.value)}
                          placeholder="Sleeping, refused, dose unavailable, caregiver delay..."
                          sx={{ mb: 2 }}
                        />
                      )}

                      <TextField
                        fullWidth
                        label="Side effects observed"
                        value={entry.sideEffectsText}
                        onChange={(e) => handleMedicationEntryChange(index, 'sideEffectsText', e.target.value)}
                        placeholder="Dizziness, nausea, swelling"
                        sx={{ mb: 2 }}
                      />

                      <TextField
                        fullWidth
                        label="Medication note"
                        value={entry.notes}
                        onChange={(e) => handleMedicationEntryChange(index, 'notes', e.target.value)}
                        placeholder="With food, dose delayed, patient asked about refill..."
                        sx={{ mb: 1 }}
                      />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(entry.refillConcern)}
                            onChange={(e) => handleMedicationEntryChange(index, 'refillConcern', e.target.checked)}
                          />
                        }
                        label="Refill concern for this medication"
                      />
                    </Paper>
                  ))}
                </Box>
              )}

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Medication summary note"
                value={checkInData.medications.notes}
                onChange={(e) => setCheckInData((prev) => ({
                  ...prev,
                  medications: {
                    ...prev.medications,
                    notes: e.target.value,
                  },
                }))}
                placeholder="Overall adherence summary or follow-up needed"
                sx={{ mt: 2 }}
              />
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Additional Notes"
              value={checkInData.notes}
              onChange={(e) => setCheckInData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any observations or concerns..."
              sx={{ mt: 3 }}
            />
          </Box>
        );

      case 4:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom fontWeight={600}>
              Check-in Complete
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Review the information below before submitting.
            </Typography>

            <Card sx={{ textAlign: 'left', mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary">Patient</Typography>
                <Typography variant="body1" fontWeight={500}>
                  {selectedPatient?.firstName} {selectedPatient?.lastName}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>Verification Method</Typography>
                <Chip
                  icon={verificationMethod === 'ble' ? <Bluetooth /> : verificationMethod === 'nfc' ? <Nfc /> : <LocationOn />}
                  label={verificationMethod.toUpperCase()}
                />

                {(checkInData.vitals.heartRate ||
                  checkInData.vitals.systolic ||
                  checkInData.vitals.temperature ||
                  checkInData.vitals.spo2 ||
                  checkInData.vitals.bloodGlucose ||
                  checkInData.vitals.respiratoryRate ||
                  checkInData.vitals.weight ||
                  checkInData.vitals.rhythmIrregularity) && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>Vitals Recorded</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {checkInData.vitals.heartRate && (
                        <Chip icon={<Favorite />} label={`HR: ${checkInData.vitals.heartRate} bpm`} />
                      )}
                      {checkInData.vitals.systolic && (
                        <Chip icon={<Favorite />} label={`BP: ${checkInData.vitals.systolic}/${checkInData.vitals.diastolic}`} />
                      )}
                      {checkInData.vitals.temperature && (
                        <Chip label={`Temp: ${checkInData.vitals.temperature} deg C`} />
                      )}
                      {checkInData.vitals.spo2 && (
                        <Chip label={`SpO2: ${checkInData.vitals.spo2}%`} />
                      )}
                      {checkInData.vitals.bloodGlucose && (
                        <Chip label={`Glucose: ${checkInData.vitals.bloodGlucose} mg/dL`} />
                      )}
                      {checkInData.vitals.respiratoryRate && (
                        <Chip label={`RR: ${checkInData.vitals.respiratoryRate} /min`} />
                      )}
                      {checkInData.vitals.weight && (
                        <Chip label={`Weight: ${checkInData.vitals.weight} kg`} />
                      )}
                      {checkInData.vitals.rhythmIrregularity && (
                        <Chip color="warning" label="Irregular rhythm flagged" />
                      )}
                    </Box>
                  </>
                )}

                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>Wellness Score</Typography>
                <Typography variant="h4" fontWeight={700} color={checkInData.wellness.overallFeeling >= 7 ? 'success.main' : checkInData.wellness.overallFeeling >= 4 ? 'warning.main' : 'error.main'}>
                  {checkInData.wellness.overallFeeling}/10
                </Typography>

                {(checkInData.functionalAssessment.changedSinceLastVisit ||
                  checkInData.functionalAssessment.recentFall ||
                  checkInData.functionalAssessment.nearFall ||
                  checkInData.functionalAssessment.confusionChange ||
                  checkInData.functionalAssessment.homeSafetyConcern) && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                      Functional Concerns
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {checkInData.functionalAssessment.changedSinceLastVisit && (
                        <Chip color="warning" size="small" label="Decline since last visit" />
                      )}
                      {checkInData.functionalAssessment.recentFall && (
                        <Chip color="error" size="small" label="Recent fall" />
                      )}
                      {checkInData.functionalAssessment.nearFall && (
                        <Chip color="warning" size="small" label="Near fall" />
                      )}
                      {checkInData.functionalAssessment.confusionChange && (
                        <Chip color="warning" size="small" label="Cognitive change" />
                      )}
                      {checkInData.functionalAssessment.homeSafetyConcern && (
                        <Chip color="warning" size="small" label="Home safety concern" />
                      )}
                    </Box>
                  </>
                )}

                {checkInData.medications.entries.length > 0 && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                      Medication Summary
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label={`Taken: ${checkInData.medications.entries.filter((entry) => entry.status === 'taken').length}`} color="success" size="small" />
                      <Chip label={`Missed: ${checkInData.medications.entries.filter((entry) => entry.status === 'missed').length}`} color="warning" size="small" />
                      <Chip label={`Refill concerns: ${checkInData.medications.entries.filter((entry) => entry.refillConcern).length}`} color="info" size="small" />
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          </Box>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return !!selectedPatient;
      case 1:
        return verificationStatus === 'verified';
      case 2:
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  // Need to import InputAdornment
  const InputAdornment = ({ position, children }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', ml: position === 'end' ? 1 : 0, mr: position === 'start' ? 1 : 0 }}>
      {children}
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          New Check-In
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Complete a patient wellness check-in
        </Typography>
      </Box>

      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Content */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          {renderStepContent(activeStep)}

          {/* Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              startIcon={<ArrowBack />}
            >
              Back
            </Button>
            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading}
                startIcon={<Save />}
              >
                Submit Check-in
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!canProceed()}
                endIcon={<ArrowForward />}
              >
                Next
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CheckInPage;
