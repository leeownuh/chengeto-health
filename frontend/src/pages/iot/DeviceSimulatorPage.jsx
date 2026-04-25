/**
 * CHENGETO Health - IoT Device Simulator
 * In-browser simulator that behaves like real devices (MQTT over WebSockets).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import {
  Sensors as SensorsIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Send as SendIcon,
  WarningAmber as WarningAmberIcon
} from '@mui/icons-material';
import mqtt from 'mqtt';
import { useAuth } from '../../contexts/AuthContext';

const buildWsUrl = () => {
  const host = window.location.hostname || '127.0.0.1';
  return `ws://${host}:8083`;
};

const randomBetween = (min, max) => Math.round((min + Math.random() * (max - min)) * 10) / 10;

const formatJson = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const DeviceSimulatorPage = () => {
  const { api, user } = useAuth();

  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState('');

  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const selectedDevice = useMemo(
    () => devices.find((d) => d.deviceId === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );

  const [mqttConnected, setMqttConnected] = useState(false);
  const [mqttError, setMqttError] = useState('');
  const mqttClientRef = useRef(null);

  const [streaming, setStreaming] = useState(false);
  const streamTimerRef = useRef(null);

  const [intervalMs, setIntervalMs] = useState(2000);
  const [heartRate, setHeartRate] = useState(72);
  const [spo2, setSpo2] = useState(97);
  const [temperature, setTemperature] = useState(36.5);
  const [activity, setActivity] = useState('stationary');
  const [fallDetected, setFallDetected] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [signalStrength, setSignalStrength] = useState(-55);
  const [sendPanic, setSendPanic] = useState(false);

  const [lastPublish, setLastPublish] = useState(null);
  const [logLines, setLogLines] = useState([]);

  const assignedPatientId = selectedDevice?.assignedPatient?._id || '';
  const topicBase = assignedPatientId ? `chengeto/${assignedPatientId}` : 'chengeto/<patientId>';

  const telemetryTopic = `${topicBase}/telemetry`;
  const statusTopic = `${topicBase}/status`;
  const alertTopic = `${topicBase}/alert`;
  const commandTopic = `${topicBase}/command`;

  const appendLog = (line) => {
    setLogLines((prev) => {
      const next = [...prev, `[${new Date().toISOString()}] ${line}`];
      return next.slice(-200);
    });
  };

  const loadDevices = async () => {
    setDevicesLoading(true);
    setDevicesError('');
    try {
      const response = await api.get('/iot/devices?limit=50&page=1');
      const payload = response?.data?.data?.devices || [];
      setDevices(payload);
      if (!selectedDeviceId && payload.length > 0) {
        setSelectedDeviceId(payload[0].deviceId);
      }
    } catch (error) {
      setDevicesError(error?.response?.data?.message || error?.message || 'Failed to load devices');
    } finally {
      setDevicesLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const connectMqtt = () => {
    setMqttError('');

    if (mqttClientRef.current) {
      try {
        mqttClientRef.current.end(true);
      } catch {
        // ignore
      }
      mqttClientRef.current = null;
    }

    const wsUrl = buildWsUrl();
    const clientId = `web-sim-${Date.now()}`;
    const username = selectedDeviceId || `sim-${user?.email || 'anonymous'}`;
    const password = 'device-secret';

    const client = mqtt.connect(wsUrl, {
      clientId,
      username,
      password,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 2000
    });

    mqttClientRef.current = client;

    client.on('connect', () => {
      setMqttConnected(true);
      appendLog(`MQTT connected (${wsUrl}) as ${username}`);
      if (assignedPatientId) {
        client.subscribe(commandTopic, { qos: 1 }, (err) => {
          if (err) appendLog(`Subscribe failed (${commandTopic}): ${err.message}`);
          else appendLog(`Subscribed: ${commandTopic}`);
        });
      }
    });

    client.on('reconnect', () => appendLog('MQTT reconnecting...'));
    client.on('close', () => setMqttConnected(false));
    client.on('error', (err) => {
      setMqttError(err.message);
      appendLog(`MQTT error: ${err.message}`);
    });
    client.on('message', (topic, message) => {
      appendLog(`MQTT message on ${topic}: ${message.toString().slice(0, 300)}`);
    });
  };

  const disconnectMqtt = () => {
    setStreaming(false);
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    const client = mqttClientRef.current;
    if (client) {
      try {
        client.end(true);
      } catch {
        // ignore
      }
      mqttClientRef.current = null;
    }
    setMqttConnected(false);
  };

  const buildTelemetryPayload = () => {
    const timestamp = new Date().toISOString();

    return {
      deviceId: selectedDeviceId || 'SIM-DEVICE',
      patientId: assignedPatientId || undefined,
      timestamp,
      vitals: {
        heartRate: Math.round(heartRate),
        oxygenSaturation: Math.round(spo2),
        temperature: Number(temperature)
      },
      motion: {
        activity,
        fallDetected: Boolean(fallDetected),
        impactForce: fallDetected ? randomBetween(1.5, 3.2) : undefined
      },
      deviceStatus: {
        batteryLevel: Math.round(batteryLevel),
        signalStrength: Math.round(signalStrength),
        charging: false,
        firmwareVersion: selectedDevice?.firmwareVersion || 'sim-1.0.0'
      },
      location: {
        latitude: -17.8292 + (Math.random() - 0.5) * 0.002,
        longitude: 31.0523 + (Math.random() - 0.5) * 0.002,
        accuracy: 12
      }
    };
  };

  const buildStatusPayload = () => {
    return {
      deviceId: selectedDeviceId || 'SIM-DEVICE',
      patientId: assignedPatientId || undefined,
      status: 'heartbeat',
      batteryLevel: Math.round(batteryLevel),
      timestamp: new Date().toISOString()
    };
  };

  const buildPanicPayload = () => {
    return {
      type: 'panic',
      severity: 'critical',
      message: 'Simulated panic button activated',
      deviceId: selectedDeviceId || 'SIM-DEVICE',
      patientId: assignedPatientId || undefined,
      timestamp: new Date().toISOString()
    };
  };

  const publishOnce = async () => {
    if (!selectedDeviceId) {
      setMqttError('Pick a device first.');
      return;
    }
    if (!assignedPatientId) {
      setMqttError('Selected device is not assigned to a patient. Seed or assign it first.');
      return;
    }

    const client = mqttClientRef.current;
    if (!client || !mqttConnected) {
      setMqttError('Connect to MQTT first.');
      return;
    }

    const telemetry = buildTelemetryPayload();
    const status = buildStatusPayload();
    const panic = sendPanic ? buildPanicPayload() : null;

    const publish = (topic, payload, qos = 1) =>
      new Promise((resolve, reject) => {
        client.publish(topic, JSON.stringify(payload), { qos }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

    try {
      await publish(statusTopic, status, 0);
      await publish(telemetryTopic, telemetry, 1);
      if (panic) {
        await publish(alertTopic, panic, 2);
      }

      setLastPublish({
        at: new Date().toISOString(),
        topics: [
          { topic: statusTopic, payload: status },
          { topic: telemetryTopic, payload: telemetry },
          ...(panic ? [{ topic: alertTopic, payload: panic }] : [])
        ]
      });
      appendLog(`Published telemetry for patient ${assignedPatientId}`);
    } catch (error) {
      setMqttError(error?.message || 'Publish failed');
      appendLog(`Publish failed: ${error?.message || error}`);
    }
  };

  const startStreaming = async () => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setStreaming(true);
    await publishOnce();
    streamTimerRef.current = setInterval(() => {
      // Add small jitter so charts look alive.
      setHeartRate((prev) => Math.max(40, Math.min(165, Math.round(prev + randomBetween(-2, 2)))));
      setSpo2((prev) => Math.max(75, Math.min(100, Math.round(prev + randomBetween(-1, 1)))));
      setTemperature((prev) => Math.max(34.5, Math.min(41.5, Math.round((prev + randomBetween(-0.1, 0.1)) * 10) / 10)));
      publishOnce();
    }, Math.max(500, Number(intervalMs) || 2000));
  };

  const stopStreaming = () => {
    setStreaming(false);
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopStreaming();
      disconnectMqtt();
    };
  }, []);

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2, alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 750 }}>
            IoT Device Simulator
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Simulates real devices via <strong>MQTT</strong> (WebSockets) and publishes telemetry/alerts using the same topic structure as the hardware.
          </Typography>
        </Box>
        <Chip
          icon={mqttConnected ? <WifiIcon /> : <WifiOffIcon />}
          label={mqttConnected ? 'MQTT Connected' : 'MQTT Disconnected'}
          color={mqttConnected ? 'success' : 'default'}
          variant={mqttConnected ? 'filled' : 'outlined'}
        />
      </Stack>

      {(devicesError || mqttError) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {devicesError || mqttError}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <SensorsIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Device & Protocol
                  </Typography>
                </Stack>
                <Divider />

                <FormControl fullWidth size="small" disabled={devicesLoading}>
                  <InputLabel id="iot-sim-device-label">Device</InputLabel>
                  <Select
                    label="Device"
                    labelId="iot-sim-device-label"
                    id="iot-sim-device"
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                  >
                    {devices.map((d) => (
                      <MenuItem key={d.deviceId} value={d.deviceId}>
                        {d.deviceId} · {d.deviceType} · {d.status}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Stack spacing={0.75}>
                  <Typography variant="caption" color="text.secondary">
                    Patient (assigned)
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {assignedPatientId || '—'}
                  </Typography>
                </Stack>

                <Stack spacing={0.75}>
                  <Typography variant="caption" color="text.secondary">
                    MQTT WS Broker
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {buildWsUrl()}
                  </Typography>
                </Stack>

                <Stack spacing={0.75}>
                  <Typography variant="caption" color="text.secondary">
                    Topics
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {telemetryTopic}
                    <br />
                    {statusTopic}
                    <br />
                    {alertTopic}
                    <br />
                    {commandTopic}
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    onClick={connectMqtt}
                    disabled={mqttConnected || !selectedDeviceId}
                    startIcon={<WifiIcon />}
                    fullWidth
                  >
                    Connect
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={disconnectMqtt}
                    disabled={!mqttConnected}
                    startIcon={<WifiOffIcon />}
                    fullWidth
                  >
                    Disconnect
                  </Button>
                </Stack>

                <Button variant="text" onClick={loadDevices} disabled={devicesLoading}>
                  Refresh devices
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Sensors (interactive)
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Heart Rate (bpm): {heartRate}
                  </Typography>
                  <Slider value={heartRate} min={35} max={180} onChange={(_, v) => setHeartRate(v)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    SpO₂ (%): {spo2}
                  </Typography>
                  <Slider value={spo2} min={75} max={100} onChange={(_, v) => setSpo2(v)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Temperature (°C)
                  </Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    inputProps={{ step: 0.1, min: 34, max: 42 }}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Activity</InputLabel>
                    <Select label="Activity" value={activity} onChange={(e) => setActivity(e.target.value)}>
                      <MenuItem value="stationary">stationary</MenuItem>
                      <MenuItem value="walking">walking</MenuItem>
                      <MenuItem value="running">running</MenuItem>
                      <MenuItem value="sitting">sitting</MenuItem>
                      <MenuItem value="standing">standing</MenuItem>
                      <MenuItem value="lying">lying</MenuItem>
                      <MenuItem value="fall_detected">fall_detected</MenuItem>
                      <MenuItem value="unknown">unknown</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Battery (%): {batteryLevel}
                  </Typography>
                  <Slider value={batteryLevel} min={0} max={100} onChange={(_, v) => setBatteryLevel(v)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Signal (dBm): {signalStrength}
                  </Typography>
                  <Slider value={signalStrength} min={-95} max={-30} onChange={(_, v) => setSignalStrength(v)} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Switch
                      checked={fallDetected}
                      onChange={(e) => setFallDetected(e.target.checked)}
                      inputProps={{ 'aria-label': 'Fall detected' }}
                    />
                    <Typography variant="body2">Fall detected</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Switch
                      checked={sendPanic}
                      onChange={(e) => setSendPanic(e.target.checked)}
                      inputProps={{ 'aria-label': 'Send panic alert' }}
                    />
                    <Typography variant="body2">Send panic alert</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    size="small"
                    label="Interval (ms)"
                    type="number"
                    value={intervalMs}
                    onChange={(e) => setIntervalMs(Number(e.target.value))}
                    inputProps={{ min: 500, step: 250 }}
                    fullWidth
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={publishOnce}
                  disabled={!mqttConnected || !selectedDeviceId}
                >
                  Publish once
                </Button>
                {!streaming ? (
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrowIcon />}
                    onClick={startStreaming}
                    disabled={!mqttConnected || !selectedDeviceId}
                  >
                    Start streaming
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<StopIcon />}
                    onClick={stopStreaming}
                  >
                    Stop streaming
                  </Button>
                )}
                <Box sx={{ flex: 1 }} />
                <Chip
                  icon={<WarningAmberIcon />}
                  label="Demo-only simulator (replaceable)"
                  variant="outlined"
                />
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    Last Published
                  </Typography>
                  {lastPublish ? (
                    <Box sx={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                      {formatJson(lastPublish)}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Nothing published yet.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    Protocol Log
                  </Typography>
                  <Box
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                      maxHeight: 340,
                      overflow: 'auto',
                      bgcolor: 'background.default',
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                      p: 1
                    }}
                  >
                    {logLines.length ? logLines.join('\n') : '—'}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DeviceSimulatorPage;
