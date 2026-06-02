/**
 * CHENGETO - About
 */

import React from 'react';
import { Box, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { HeartHandshake, ShieldCheck, Users, WifiOff } from 'lucide-react';

const ValueCard = ({ icon, title, description }) => (
  <Card variant="outlined" sx={{ height: '100%', borderRadius: 4 }}>
    <CardContent sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Box sx={{ color: 'primary.main', display: 'inline-flex' }}>{icon}</Box>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Stack>
    </CardContent>
  </Card>
);

const AboutPage = () => {
  return (
    <Box sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 950 }}>
            About CHENGETO
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 900 }}>
            CHENGETO is a community-centered digital health monitoring platform built for proactive elderly care—especially
            in settings where care teams need secure coordination and connectivity can be unreliable.
          </Typography>
        </Stack>

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={3}>
            <ValueCard
              icon={<HeartHandshake size={22} />}
              title="Human-centered"
              description="Workflows are designed around the people delivering and receiving care—caregivers, CHWs, clinicians, and families."
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <ValueCard
              icon={<WifiOff size={22} />}
              title="Offline-ready"
              description="Field operations keep moving with offline-first UX patterns and reliable sync when online."
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <ValueCard
              icon={<ShieldCheck size={22} />}
              title="Secure by design"
              description="Role-based access helps protect sensitive health information and supports accountable operations."
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <ValueCard
              icon={<Users size={22} />}
              title="Coordinated care"
              description="From monitoring to escalation, CHENGETO supports timely action with shared visibility across roles."
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 5, p: { xs: 3, md: 4 }, borderRadius: 6, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={1}>
            <Typography variant="h5" sx={{ fontWeight: 950 }}>
              What makes it different
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 950 }}>
              CHENGETO combines role-specific dashboards, alert escalation, IoT telemetry patterns (MQTT), and offline-first
              PWA behavior to support proactive monitoring. It is designed to be demonstrable end-to-end and adaptable to
              local protocols.
            </Typography>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default AboutPage;

