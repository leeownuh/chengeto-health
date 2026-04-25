/**
 * CHENGETO Health - Patient Form Page
 * Create and edit patient records
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  InputAdornment,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Autocomplete,
  Divider,
  LinearProgress,
  Paper,
  Avatar,
} from '@mui/material';
import {
  Person,
  Phone,
  Email,
  LocationOn,
  ArrowForward,
  ArrowBack,
  Save,
  Close,
  Add,
  Delete,
  Medication,
  Warning,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import {
  ELDERLY_NCD_OPTIONS,
  getElderlyNcdMonitoringSummary
} from '../../constants/elderlyNcdProfiles';

const steps = ['Personal Information', 'Medical Information', 'Emergency Contact', 'Care Preferences'];

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const careLevels = ['standard', 'enhanced', 'intensive', 'palliative'];
const mobilityStatuses = ['independent', 'assisted', 'wheelchair', 'bedbound'];
const gaitLevels = ['steady', 'slow', 'shuffling', 'unsteady'];
const balanceLevels = ['stable', 'needs_support', 'unstable'];
const assistiveDevices = ['none', 'cane', 'walker', 'wheelchair', 'bed_rail', 'other'];
const visionLevels = ['adequate', 'impaired', 'severely_impaired'];
const hearingLevels = ['adequate', 'impaired', 'severely_impaired'];
const continenceLevels = ['independent', 'occasional_issues', 'incontinent'];
const weightLossRiskLevels = ['low', 'moderate', 'high'];
const frailtyLevels = ['robust', 'pre_frail', 'frail'];
const homeSafetyLevels = ['safe', 'needs_minor_changes', 'unsafe'];
const genders = ['Male', 'Female', 'Other'];
const carePlanRiskLevels = ['low', 'moderate', 'high', 'critical'];
const preferredVisitWindows = ['morning', 'afternoon', 'evening', 'flexible'];
const responderRoles = ['caregiver', 'chw', 'clinician'];
const familyAccessLevels = ['full', 'limited', 'emergency_only'];

const createInitialCarePlan = () => ({
  goals: [
    { title: '', targetDate: '', status: 'active', notes: '' },
    { title: '', targetDate: '', status: 'active', notes: '' },
  ],
  riskProfile: {
    summary: '',
    fallRisk: 'moderate',
    medicationRisk: 'moderate',
    cognitiveRisk: 'moderate',
    socialRisk: 'moderate',
    caregiverInstructions: '',
  },
  visitCadence: {
    frequency: 'daily',
    preferredWindow: 'morning',
    preferredDays: [],
    notes: '',
  },
  escalationPreferences: {
    primaryResponderRole: 'caregiver',
    notifyFamily: true,
    notifyClinicianOnHighRisk: true,
    maxResponseMinutes: 30,
  },
  consentSettings: {
    familyAccessLevel: 'limited',
    familyUpdates: true,
    emergencySharing: true,
    dataCollection: true,
  },
  review: {
    nextReviewDate: '',
    notes: '',
  },
});

const formatDateInput = (value) => {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
};

const buildCarePlanDraft = (carePlan = {}, fallbackFrequency = 'daily') => {
  const defaults = createInitialCarePlan();
  const incomingGoals = Array.isArray(carePlan.goals) ? carePlan.goals : [];

  return {
    ...defaults,
    ...carePlan,
    goals: [0, 1].map((index) => ({
      ...defaults.goals[index],
      ...(incomingGoals[index] || {}),
      targetDate: formatDateInput(incomingGoals[index]?.targetDate),
    })),
    riskProfile: {
      ...defaults.riskProfile,
      ...(carePlan.riskProfile || {}),
    },
    visitCadence: {
      ...defaults.visitCadence,
      ...(carePlan.visitCadence || {}),
      frequency: carePlan.visitCadence?.frequency || fallbackFrequency || defaults.visitCadence.frequency,
    },
    escalationPreferences: {
      ...defaults.escalationPreferences,
      ...(carePlan.escalationPreferences || {}),
    },
    consentSettings: {
      ...defaults.consentSettings,
      ...(carePlan.consentSettings || {}),
    },
    review: {
      ...defaults.review,
      ...(carePlan.review || {}),
      nextReviewDate: formatDateInput(carePlan.review?.nextReviewDate),
    },
  };
};

const initialFormData = {
  // Personal
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  bloodType: '',
  phone: '',
  email: '',
  address: {
    street: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Zimbabwe',
  },
  nationalId: '',

  // Medical
  primaryDiagnosis: '',
  secondaryDiagnoses: [],
  ncdConditions: [],
  allergies: [],
  currentMedications: [],
  medicalHistory: '',
  careLevel: 'standard',
  mobilityStatus: 'independent',

  // Emergency Contact
  emergencyContact: {
    name: '',
    relationship: '',
    phone: '',
    email: '',
  },

  // Care Preferences
  assignedCHW: '',
  checkInFrequency: 'daily',
  vitalThresholds: {
    heartRateMin: 60,
    heartRateMax: 100,
    systolicMin: 90,
    systolicMax: 140,
    diastolicMin: 60,
    diastolicMax: 90,
    temperatureMin: 36.0,
    temperatureMax: 37.5,
    spo2Min: 95,
    spo2Max: 100,
    respiratoryRateMin: 12,
    respiratoryRateMax: 24,
    bloodGlucoseMin: 70,
    bloodGlucoseMax: 180,
    weightMin: 35,
    weightMax: 150,
  },
  carePlan: createInitialCarePlan(),
  functionalBaseline: {
    mobility: 'independent',
    gait: 'steady',
    balance: 'stable',
    assistiveDevice: 'none',
    vision: 'adequate',
    hearing: 'adequate',
    continence: 'independent',
    weightLossRisk: 'low',
    frailty: 'robust',
    homeSafety: 'safe',
    recentFalls: {
      count: 0,
      lastFallAt: '',
      injuryFromLastFall: false,
    },
    notes: '',
  },
  notes: '',
};

const PatientFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const isEditing = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState(initialFormData);
  const [chwOptions, setChwOptions] = useState([]);

  // For array fields
  const [newAllergy, setNewAllergy] = useState('');
  const [newMedication, setNewMedication] = useState('');
  const [newDiagnosis, setNewDiagnosis] = useState('');
  const selectedMonitoringSummary = getElderlyNcdMonitoringSummary(formData.ncdConditions);

  useEffect(() => {
    fetchCHWs();
    if (isEditing) {
      fetchPatient();
    }
  }, [id]);

  const fetchCHWs = async () => {
    try {
      const response = await axios.get('/api/users?role=chw&active=true');
      setChwOptions(response.data?.users || response.data?.data?.users || []);
    } catch (error) {
      console.error('Failed to fetch CHWs:', error);
    }
  };

  const fetchPatient = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/patients/${id}`);
      const patient = response.data?.data || response.data || {};
      const carePlan = buildCarePlanDraft(
        patient.carePlan,
        patient.carePlan?.visitCadence?.frequency || patient.checkInFrequency || initialFormData.checkInFrequency
      );
      const baseline = patient.functionalBaseline && typeof patient.functionalBaseline === 'object'
        ? patient.functionalBaseline
        : {};
      setFormData({
        ...initialFormData,
        ...patient,
        address: {
          ...initialFormData.address,
          ...(patient.address || {}),
          street: patient.address?.street || patient.address?.village || '',
          city: patient.address?.city || patient.address?.district || '',
        },
        emergencyContact: {
          ...initialFormData.emergencyContact,
          ...(patient.emergencyContact || {}),
        },
        allergies: (patient.allergies || []).map((allergy) =>
          typeof allergy === 'string' ? allergy : allergy?.allergen
        ).filter(Boolean),
        currentMedications: (patient.currentMedications || []).map((medication) =>
          typeof medication === 'string' ? medication : medication?.name
        ).filter(Boolean),
        primaryDiagnosis: patient.primaryDiagnosis || patient.medicalSummary || '',
        secondaryDiagnoses: patient.secondaryDiagnoses || [],
        ncdConditions: (patient.ncdConditions || []).map((entry) =>
          typeof entry === 'string' ? entry : entry?.type
        ).filter(Boolean),
        assignedCHW: patient.assignedCHWId || patient.assignedCHW?._id || patient.assignedCHW || '',
        checkInFrequency: carePlan.visitCadence.frequency || initialFormData.checkInFrequency,
        carePlan,
        functionalBaseline: {
          ...initialFormData.functionalBaseline,
          ...baseline,
          mobility: baseline.mobility || initialFormData.functionalBaseline.mobility,
          gait: baseline.gait || initialFormData.functionalBaseline.gait,
          balance: baseline.balance || initialFormData.functionalBaseline.balance,
          assistiveDevice: baseline.assistiveDevice || initialFormData.functionalBaseline.assistiveDevice,
          vision: baseline.vision || initialFormData.functionalBaseline.vision,
          hearing: baseline.hearing || initialFormData.functionalBaseline.hearing,
          continence: baseline.continence || initialFormData.functionalBaseline.continence,
          weightLossRisk: baseline.weightLossRisk || initialFormData.functionalBaseline.weightLossRisk,
          frailty: baseline.frailty || initialFormData.functionalBaseline.frailty,
          homeSafety: baseline.homeSafety || initialFormData.functionalBaseline.homeSafety,
          recentFalls: {
            ...initialFormData.functionalBaseline.recentFalls,
            ...(baseline.recentFalls || {}),
            lastFallAt: formatDateInput(baseline.recentFalls?.lastFallAt),
          },
          notes: baseline.notes || '',
        },
      });
    } catch (error) {
      enqueueSnackbar('Failed to load patient data', { variant: 'error' });
      navigate('/patients');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      ...(name === 'checkInFrequency'
        ? {
            carePlan: {
              ...prev.carePlan,
              visitCadence: {
                ...prev.carePlan.visitCadence,
                frequency: value,
              },
            },
          }
        : {}),
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        [name]: value,
      },
    }));
  };

  const handleEmergencyContactChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      emergencyContact: {
        ...prev.emergencyContact,
        [name]: value,
      },
    }));
  };

  const handleFunctionalBaselineChange = (field, value) => {
    setFormData((prev) => {
      const nextBaseline = {
        ...(prev.functionalBaseline || initialFormData.functionalBaseline),
        [field]: value
      };

      const nextMobilityStatus =
        field === 'mobility' ? value : (prev.mobilityStatus || nextBaseline.mobility);

      return {
        ...prev,
        mobilityStatus: nextMobilityStatus,
        functionalBaseline: nextBaseline
      };
    });
  };

  const handleRecentFallsChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      functionalBaseline: {
        ...(prev.functionalBaseline || initialFormData.functionalBaseline),
        recentFalls: {
          ...((prev.functionalBaseline || initialFormData.functionalBaseline).recentFalls || {}),
          [field]: value
        }
      }
    }));
  };

  const handleThresholdChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      vitalThresholds: {
        ...prev.vitalThresholds,
        [name]: parseFloat(value) || 0,
      },
    }));
  };

  const handleCarePlanSectionChange = (section, name, value) => {
    setFormData((prev) => ({
      ...prev,
      carePlan: {
        ...prev.carePlan,
        [section]: {
          ...prev.carePlan[section],
          [name]: value,
        },
      },
    }));
  };

  const handleGoalChange = (index, name, value) => {
    setFormData((prev) => ({
      ...prev,
      carePlan: {
        ...prev.carePlan,
        goals: prev.carePlan.goals.map((goal, goalIndex) =>
          goalIndex === index ? { ...goal, [name]: value } : goal
        ),
      },
    }));
  };

  const handleAddArrayItem = (field, value, setter) => {
    if (value.trim()) {
      setFormData((prev) => ({
        ...prev,
        [field]: [...prev[field], value.trim()],
      }));
      setter('');
    }
  };

  const handleRemoveArrayItem = (field, index) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 0:
        if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
        if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
        if (!formData.gender) newErrors.gender = 'Gender is required';
        if (!formData.phone.trim()) {
          newErrors.phone = 'Phone number is required';
        } else if (!/^\+?[0-9]{10,15}$/.test(formData.phone.replace(/\s/g, ''))) {
          newErrors.phone = 'Invalid phone number format';
        }
        break;
      case 1:
        // Medical info is optional
        break;
      case 2:
        if (!formData.emergencyContact.name.trim()) {
          newErrors['emergencyContact.name'] = 'Emergency contact name is required';
        }
        if (!formData.emergencyContact.phone.trim()) {
          newErrors['emergencyContact.phone'] = 'Emergency contact phone is required';
        }
        break;
      case 3:
        // Care preferences are optional
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(activeStep)) return;

    setSaving(true);
    try {
      const baseline = formData.functionalBaseline || initialFormData.functionalBaseline;
      const recentFalls = baseline.recentFalls || {};
      const sanitizedBaseline = {
        ...baseline,
        recentFalls: {
          ...recentFalls,
          count: Number.isFinite(Number(recentFalls.count)) ? Number(recentFalls.count) : 0,
          lastFallAt: recentFalls.lastFallAt ? recentFalls.lastFallAt : undefined,
          injuryFromLastFall: Boolean(recentFalls.injuryFromLastFall)
        }
      };
      const payload = {
        ...formData,
        carePlan: {
          ...formData.carePlan,
          visitCadence: {
            ...formData.carePlan.visitCadence,
            frequency: formData.checkInFrequency,
          },
        },
        functionalBaseline: sanitizedBaseline
      };

      if (isEditing) {
        await axios.put(`/api/patients/${id}`, payload);
        enqueueSnackbar('Patient updated successfully', { variant: 'success' });
      } else {
        const response = await axios.post('/api/patients', payload);
        enqueueSnackbar('Patient created successfully', { variant: 'success' });
        const createdId = response.data?._id || response.data?.data?._id;
        navigate(`/patients/${createdId}`);
        return;
      }
      navigate(`/patients/${id}`);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to save patient';
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Personal Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                error={!!errors.firstName}
                helperText={errors.firstName}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                error={!!errors.lastName}
                helperText={errors.lastName}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date of Birth"
                name="dateOfBirth"
                type="date"
                value={formData.dateOfBirth?.split('T')[0] || ''}
                onChange={handleChange}
                error={!!errors.dateOfBirth}
                helperText={errors.dateOfBirth}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.gender}>
                <InputLabel>Gender *</InputLabel>
                <Select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  label="Gender *"
                >
                  {genders.map((g) => (
                    <MenuItem key={g} value={g}>{g}</MenuItem>
                  ))}
                </Select>
                {errors.gender && (
                  <Typography variant="caption" color="error">
                    {errors.gender}
                  </Typography>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                error={!!errors.phone}
                helperText={errors.phone || 'Include country code (e.g., +263)'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone />
                    </InputAdornment>
                  ),
                }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Blood Type</InputLabel>
                <Select
                  name="bloodType"
                  value={formData.bloodType}
                  onChange={handleChange}
                  label="Blood Type"
                >
                  {bloodTypes.map((bt) => (
                    <MenuItem key={bt} value={bt}>{bt}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="National ID"
                name="nationalId"
                value={formData.nationalId}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Address
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Street Address"
                name="street"
                value={formData.address.street}
                onChange={handleAddressChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationOn />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="City"
                name="city"
                value={formData.address.city}
                onChange={handleAddressChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Province"
                name="province"
                value={formData.address.province}
                onChange={handleAddressChange}
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Medical Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Primary Diagnosis"
                name="primaryDiagnosis"
                value={formData.primaryDiagnosis}
                onChange={handleChange}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Secondary Diagnoses
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  value={newDiagnosis}
                  onChange={(e) => setNewDiagnosis(e.target.value)}
                  placeholder="Add diagnosis..."
                  sx={{ flex: 1 }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddArrayItem('secondaryDiagnoses', newDiagnosis, setNewDiagnosis);
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={() => handleAddArrayItem('secondaryDiagnoses', newDiagnosis, setNewDiagnosis)}
                >
                  Add
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {formData.secondaryDiagnoses.map((diagnosis, index) => (
                  <Chip
                    key={index}
                    label={diagnosis}
                    onDelete={() => handleRemoveArrayItem('secondaryDiagnoses', index)}
                    sx={{ mb: 0.5 }}
                  />
                ))}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={ELDERLY_NCD_OPTIONS}
                value={ELDERLY_NCD_OPTIONS.filter((option) => formData.ncdConditions.includes(option.value))}
                onChange={(_, nextValue) => {
                  setFormData((prev) => ({
                    ...prev,
                    ncdConditions: nextValue.map((option) => option.value),
                  }));
                }}
                getOptionLabel={(option) => option.label}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.value}
                      label={option.label}
                      color={option.monitoringLevel === 'direct_device' ? 'success' : option.monitoringLevel === 'mixed' ? 'primary' : 'default'}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Older Adult Chronic Conditions"
                    placeholder="Select NCD profiles"
                    helperText="Choose the major elderly chronic conditions so the system can recommend the right device inputs."
                  />
                )}
              />
            </Grid>

            {formData.ncdConditions.length > 0 && (
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="subtitle2" gutterBottom>
                    Monitoring Plan
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Monitoring type: {selectedMonitoringSummary.monitoringLevel.replace(/_/g, ' ')}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Recommended device or home signals: {selectedMonitoringSummary.signalLabels.join(', ')}
                  </Typography>
                  <Typography variant="body2">
                    {selectedMonitoringSummary.notes[0]}
                  </Typography>
                </Alert>
              </Grid>
            )}

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Allergies
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  placeholder="Add allergy..."
                  sx={{ flex: 1 }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddArrayItem('allergies', newAllergy, setNewAllergy);
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={() => handleAddArrayItem('allergies', newAllergy, setNewAllergy)}
                >
                  Add
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {formData.allergies.map((allergy, index) => (
                  <Chip
                    key={index}
                    label={allergy}
                    onDelete={() => handleRemoveArrayItem('allergies', index)}
                    color="warning"
                    icon={<Warning />}
                    sx={{ mb: 0.5 }}
                  />
                ))}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Current Medications
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  value={newMedication}
                  onChange={(e) => setNewMedication(e.target.value)}
                  placeholder="Add medication..."
                  sx={{ flex: 1 }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddArrayItem('currentMedications', newMedication, setNewMedication);
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={() => handleAddArrayItem('currentMedications', newMedication, setNewMedication)}
                >
                  Add
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {formData.currentMedications.map((medication, index) => (
                  <Chip
                    key={index}
                    label={medication}
                    onDelete={() => handleRemoveArrayItem('currentMedications', index)}
                    icon={<Medication />}
                    sx={{ mb: 0.5 }}
                  />
                ))}
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Care Level</InputLabel>
                <Select
                  name="careLevel"
                  value={formData.careLevel}
                  onChange={handleChange}
                  label="Care Level"
                >
                  {careLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Mobility Status</InputLabel>
                <Select
                  name="mobilityStatus"
                  value={formData.mobilityStatus}
                  onChange={handleChange}
                  label="Mobility Status"
                >
                  {mobilityStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Functional Baseline (Fall Risk)
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Baseline Mobility</InputLabel>
                <Select
                  value={formData.functionalBaseline?.mobility || initialFormData.functionalBaseline.mobility}
                  label="Baseline Mobility"
                  onChange={(e) => handleFunctionalBaselineChange('mobility', e.target.value)}
                >
                  {mobilityStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Gait</InputLabel>
                <Select
                  value={formData.functionalBaseline?.gait || initialFormData.functionalBaseline.gait}
                  label="Gait"
                  onChange={(e) => handleFunctionalBaselineChange('gait', e.target.value)}
                >
                  {gaitLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Balance</InputLabel>
                <Select
                  value={formData.functionalBaseline?.balance || initialFormData.functionalBaseline.balance}
                  label="Balance"
                  onChange={(e) => handleFunctionalBaselineChange('balance', e.target.value)}
                >
                  {balanceLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Assistive Device</InputLabel>
                <Select
                  value={formData.functionalBaseline?.assistiveDevice || initialFormData.functionalBaseline.assistiveDevice}
                  label="Assistive Device"
                  onChange={(e) => handleFunctionalBaselineChange('assistiveDevice', e.target.value)}
                >
                  {assistiveDevices.map((device) => (
                    <MenuItem key={device} value={device}>
                      {device.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Vision</InputLabel>
                <Select
                  value={formData.functionalBaseline?.vision || initialFormData.functionalBaseline.vision}
                  label="Vision"
                  onChange={(e) => handleFunctionalBaselineChange('vision', e.target.value)}
                >
                  {visionLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Hearing</InputLabel>
                <Select
                  value={formData.functionalBaseline?.hearing || initialFormData.functionalBaseline.hearing}
                  label="Hearing"
                  onChange={(e) => handleFunctionalBaselineChange('hearing', e.target.value)}
                >
                  {hearingLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Continence</InputLabel>
                <Select
                  value={formData.functionalBaseline?.continence || initialFormData.functionalBaseline.continence}
                  label="Continence"
                  onChange={(e) => handleFunctionalBaselineChange('continence', e.target.value)}
                >
                  {continenceLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Weight Loss Risk</InputLabel>
                <Select
                  value={formData.functionalBaseline?.weightLossRisk || initialFormData.functionalBaseline.weightLossRisk}
                  label="Weight Loss Risk"
                  onChange={(e) => handleFunctionalBaselineChange('weightLossRisk', e.target.value)}
                >
                  {weightLossRiskLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Frailty</InputLabel>
                <Select
                  value={formData.functionalBaseline?.frailty || initialFormData.functionalBaseline.frailty}
                  label="Frailty"
                  onChange={(e) => handleFunctionalBaselineChange('frailty', e.target.value)}
                >
                  {frailtyLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Home Safety</InputLabel>
                <Select
                  value={formData.functionalBaseline?.homeSafety || initialFormData.functionalBaseline.homeSafety}
                  label="Home Safety"
                  onChange={(e) => handleFunctionalBaselineChange('homeSafety', e.target.value)}
                >
                  {homeSafetyLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Recent Falls (Count)"
                value={formData.functionalBaseline?.recentFalls?.count ?? 0}
                onChange={(e) => handleRecentFallsChange('count', e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Last Fall Date"
                value={formData.functionalBaseline?.recentFalls?.lastFallAt || ''}
                onChange={(e) => handleRecentFallsChange('lastFallAt', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Injury From Last Fall</InputLabel>
                <Select
                  value={formData.functionalBaseline?.recentFalls?.injuryFromLastFall ? 'yes' : 'no'}
                  label="Injury From Last Fall"
                  onChange={(e) => handleRecentFallsChange('injuryFromLastFall', e.target.value === 'yes')}
                >
                  <MenuItem value="no">No</MenuItem>
                  <MenuItem value="yes">Yes</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Baseline Notes"
                value={formData.functionalBaseline?.notes || ''}
                onChange={(e) => handleFunctionalBaselineChange('notes', e.target.value)}
                multiline
                rows={2}
                placeholder="Mobility notes, home hazards, caregiver observations..."
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Additional Medical History"
                name="medicalHistory"
                value={formData.medicalHistory}
                onChange={handleChange}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Emergency Contact
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Name"
                name="name"
                value={formData.emergencyContact.name}
                onChange={handleEmergencyContactChange}
                error={!!errors['emergencyContact.name']}
                helperText={errors['emergencyContact.name']}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Relationship"
                name="relationship"
                value={formData.emergencyContact.relationship}
                onChange={handleEmergencyContactChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                name="phone"
                value={formData.emergencyContact.phone}
                onChange={handleEmergencyContactChange}
                error={!!errors['emergencyContact.phone']}
                helperText={errors['emergencyContact.phone']}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone />
                    </InputAdornment>
                  ),
                }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.emergencyContact.email}
                onChange={handleEmergencyContactChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        );

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Care Preferences
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Assign CHW</InputLabel>
                <Select
                  name="assignedCHW"
                  value={formData.assignedCHW}
                  onChange={handleChange}
                  label="Assign CHW"
                >
                  <MenuItem value="">None</MenuItem>
                  {chwOptions.map((chw) => (
                    <MenuItem key={chw._id} value={chw._id}>
                      {chw.firstName} {chw.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Check-in Frequency</InputLabel>
                <Select
                  name="checkInFrequency"
                  value={formData.checkInFrequency}
                  onChange={handleChange}
                  label="Check-in Frequency"
                >
                  <MenuItem value="twice-daily">Twice Daily</MenuItem>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="alternate">Alternate Days</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Personalized Care Plan
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Capture the core goals, risk profile, visit cadence, and escalation preferences for this elder.
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Primary Care Goal"
                value={formData.carePlan.goals[0].title}
                onChange={(e) => handleGoalChange(0, 'title', e.target.value)}
                placeholder="Maintain medication adherence"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Primary Goal Target Date"
                type="date"
                value={formData.carePlan.goals[0].targetDate}
                onChange={(e) => handleGoalChange(0, 'targetDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Secondary Care Goal"
                value={formData.carePlan.goals[1].title}
                onChange={(e) => handleGoalChange(1, 'title', e.target.value)}
                placeholder="Reduce fall risk at home"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Secondary Goal Target Date"
                type="date"
                value={formData.carePlan.goals[1].targetDate}
                onChange={(e) => handleGoalChange(1, 'targetDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Risk Summary"
                value={formData.carePlan.riskProfile.summary}
                onChange={(e) => handleCarePlanSectionChange('riskProfile', 'summary', e.target.value)}
                placeholder="Lives alone, misses doses when confused, unsteady when walking outside"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Fall Risk</InputLabel>
                <Select
                  value={formData.carePlan.riskProfile.fallRisk}
                  onChange={(e) => handleCarePlanSectionChange('riskProfile', 'fallRisk', e.target.value)}
                  label="Fall Risk"
                >
                  {carePlanRiskLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Medication Risk</InputLabel>
                <Select
                  value={formData.carePlan.riskProfile.medicationRisk}
                  onChange={(e) => handleCarePlanSectionChange('riskProfile', 'medicationRisk', e.target.value)}
                  label="Medication Risk"
                >
                  {carePlanRiskLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Cognitive Risk</InputLabel>
                <Select
                  value={formData.carePlan.riskProfile.cognitiveRisk}
                  onChange={(e) => handleCarePlanSectionChange('riskProfile', 'cognitiveRisk', e.target.value)}
                  label="Cognitive Risk"
                >
                  {carePlanRiskLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Social Risk</InputLabel>
                <Select
                  value={formData.carePlan.riskProfile.socialRisk}
                  onChange={(e) => handleCarePlanSectionChange('riskProfile', 'socialRisk', e.target.value)}
                  label="Social Risk"
                >
                  {carePlanRiskLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Preferred Visit Window</InputLabel>
                <Select
                  value={formData.carePlan.visitCadence.preferredWindow}
                  onChange={(e) => handleCarePlanSectionChange('visitCadence', 'preferredWindow', e.target.value)}
                  label="Preferred Visit Window"
                >
                  {preferredVisitWindows.map((window) => (
                    <MenuItem key={window} value={window}>
                      {window.charAt(0).toUpperCase() + window.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Cadence Notes"
                value={formData.carePlan.visitCadence.notes}
                onChange={(e) => handleCarePlanSectionChange('visitCadence', 'notes', e.target.value)}
                placeholder="Prefer first visit before breakfast"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Primary Responder</InputLabel>
                <Select
                  value={formData.carePlan.escalationPreferences.primaryResponderRole}
                  onChange={(e) =>
                    handleCarePlanSectionChange('escalationPreferences', 'primaryResponderRole', e.target.value)
                  }
                  label="Primary Responder"
                >
                  {responderRoles.map((role) => (
                    <MenuItem key={role} value={role}>
                      {role.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Max Response Minutes"
                type="number"
                value={formData.carePlan.escalationPreferences.maxResponseMinutes}
                onChange={(e) =>
                  handleCarePlanSectionChange('escalationPreferences', 'maxResponseMinutes', Number(e.target.value))
                }
                InputProps={{ inputProps: { min: 5, max: 1440 } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Notify Family on Alert</InputLabel>
                <Select
                  value={formData.carePlan.escalationPreferences.notifyFamily}
                  onChange={(e) =>
                    handleCarePlanSectionChange('escalationPreferences', 'notifyFamily', e.target.value)
                  }
                  label="Notify Family on Alert"
                >
                  <MenuItem value={true}>Yes</MenuItem>
                  <MenuItem value={false}>No</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Notify Clinician on High Risk</InputLabel>
                <Select
                  value={formData.carePlan.escalationPreferences.notifyClinicianOnHighRisk}
                  onChange={(e) =>
                    handleCarePlanSectionChange('escalationPreferences', 'notifyClinicianOnHighRisk', e.target.value)
                  }
                  label="Notify Clinician on High Risk"
                >
                  <MenuItem value={true}>Yes</MenuItem>
                  <MenuItem value={false}>No</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Family Access Level</InputLabel>
                <Select
                  value={formData.carePlan.consentSettings.familyAccessLevel}
                  onChange={(e) => handleCarePlanSectionChange('consentSettings', 'familyAccessLevel', e.target.value)}
                  label="Family Access Level"
                >
                  {familyAccessLevels.map((level) => (
                    <MenuItem key={level} value={level}>
                      {level.replaceAll('_', ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Routine Family Updates</InputLabel>
                <Select
                  value={formData.carePlan.consentSettings.familyUpdates}
                  onChange={(e) => handleCarePlanSectionChange('consentSettings', 'familyUpdates', e.target.value)}
                  label="Routine Family Updates"
                >
                  <MenuItem value={true}>Yes</MenuItem>
                  <MenuItem value={false}>No</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Emergency Data Sharing</InputLabel>
                <Select
                  value={formData.carePlan.consentSettings.emergencySharing}
                  onChange={(e) => handleCarePlanSectionChange('consentSettings', 'emergencySharing', e.target.value)}
                  label="Emergency Data Sharing"
                >
                  <MenuItem value={true}>Yes</MenuItem>
                  <MenuItem value={false}>No</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Next Review Date"
                type="date"
                value={formData.carePlan.review.nextReviewDate}
                onChange={(e) => handleCarePlanSectionChange('review', 'nextReviewDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Caregiver Instructions"
                value={formData.carePlan.riskProfile.caregiverInstructions}
                onChange={(e) =>
                  handleCarePlanSectionChange('riskProfile', 'caregiverInstructions', e.target.value)
                }
                placeholder="Observe confusion before bedtime, encourage hydration, confirm evening dose taken"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Vital Sign Thresholds
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Configure alert thresholds for vital sign monitoring
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Temperature Min (deg C)"
                  name="temperatureMin"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  value={formData.vitalThresholds.temperatureMin}
                  onChange={handleThresholdChange}
                />
                <TextField
                  fullWidth
                  label="Temperature Max (deg C)"
                  name="temperatureMax"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  value={formData.vitalThresholds.temperatureMax}
                  onChange={handleThresholdChange}
                />
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Heart Rate Min"
                  name="heartRateMin"
                  type="number"
                  value={formData.vitalThresholds.heartRateMin}
                  onChange={handleThresholdChange}
                  InputProps={{ inputProps: { min: 0, max: 300 } }}
                />
                <TextField
                  fullWidth
                  label="Heart Rate Max"
                  name="heartRateMax"
                  type="number"
                  value={formData.vitalThresholds.heartRateMax}
                  onChange={handleThresholdChange}
                  InputProps={{ inputProps: { min: 0, max: 300 } }}
                />
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Systolic Min"
                  name="systolicMin"
                  type="number"
                  value={formData.vitalThresholds.systolicMin}
                  onChange={handleThresholdChange}
                />
                <TextField
                  fullWidth
                  label="Systolic Max"
                  name="systolicMax"
                  type="number"
                  value={formData.vitalThresholds.systolicMax}
                  onChange={handleThresholdChange}
                />
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Diastolic Min"
                  name="diastolicMin"
                  type="number"
                  value={formData.vitalThresholds.diastolicMin}
                  onChange={handleThresholdChange}
                />
                <TextField
                  fullWidth
                  label="Diastolic Max"
                  name="diastolicMax"
                  type="number"
                  value={formData.vitalThresholds.diastolicMax}
                  onChange={handleThresholdChange}
                />
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  label="SpO2 Min (%)"
                  name="spo2Min"
                  type="number"
                  value={formData.vitalThresholds.spo2Min}
                  onChange={handleThresholdChange}
                  InputProps={{ inputProps: { min: 0, max: 100 } }}
                />
                <TextField
                  fullWidth
                  label="SpO2 Max (%)"
                  name="spo2Max"
                  type="number"
                  value={formData.vitalThresholds.spo2Max}
                  onChange={handleThresholdChange}
                  InputProps={{ inputProps: { min: 0, max: 100 } }}
                />
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Respiratory Rate Min"
                  name="respiratoryRateMin"
                  type="number"
                  value={formData.vitalThresholds.respiratoryRateMin ?? 12}
                  onChange={handleThresholdChange}
                />
                <TextField
                  fullWidth
                  label="Respiratory Rate Max"
                  name="respiratoryRateMax"
                  type="number"
                  value={formData.vitalThresholds.respiratoryRateMax ?? 24}
                  onChange={handleThresholdChange}
                />
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Blood Glucose Min"
                  name="bloodGlucoseMin"
                  type="number"
                  value={formData.vitalThresholds.bloodGlucoseMin ?? 70}
                  onChange={handleThresholdChange}
                />
                <TextField
                  fullWidth
                  label="Blood Glucose Max"
                  name="bloodGlucoseMax"
                  type="number"
                  value={formData.vitalThresholds.bloodGlucoseMax ?? 180}
                  onChange={handleThresholdChange}
                />
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Weight Min (kg)"
                  name="weightMin"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  value={formData.vitalThresholds.weightMin ?? 35}
                  onChange={handleThresholdChange}
                />
                <TextField
                  fullWidth
                  label="Weight Max (kg)"
                  name="weightMax"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  value={formData.vitalThresholds.weightMax ?? 150}
                  onChange={handleThresholdChange}
                />
              </Box>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Additional Notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          {isEditing ? 'Edit Patient' : 'New Patient'}
        </Typography>
        <Button startIcon={<Close />} onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </Box>

      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Form Content */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          {renderStepContent(activeStep)}

          {/* Navigation Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              startIcon={<ArrowBack />}
            >
              Back
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={saving}
                  startIcon={<Save />}
                >
                  {saving ? 'Saving...' : (isEditing ? 'Update Patient' : 'Create Patient')}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  endIcon={<ArrowForward />}
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PatientFormPage;
