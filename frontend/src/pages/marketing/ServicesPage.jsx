/**
 * CHENGETO - Services
 */

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { ArrowRight, BellRing, ClipboardList, Cloud, Smartphone, Users } from 'lucide-react';

const ServiceCard = ({ title, description, bullets, icon }) => (
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
        <Stack component="ul" sx={{ pl: 2, m: 0, color: 'text.secondary' }} spacing={0.5}>
          {bullets.map((b) => (
            <Typography key={b} component="li" variant="body2" color="text.secondary">
              {b}
            </Typography>
          ))}
        </Stack>
      </Stack>
    </CardContent>
  </Card>
);

const ServicesPage = () => {
  return (
    <Box sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 950 }}>
            Services
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 820 }}>
            CHENGETO can be deployed as a complete platform or integrated with your existing care programs. We support
            configuration, onboarding, and operational readiness for community and clinic workflows.
          </Typography>
        </Stack>

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <ServiceCard
              icon={<Users size={22} />}
              title="Role-based care workflows"
              description="Coordinate responsibilities across teams with purpose-built dashboards."
              bullets={[
                'Admin, caregiver, CHW, clinician, and family roles',
                'Protected routes and clear access boundaries',
                'Actionable views for day-to-day operations',
              ]}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <ServiceCard
              icon={<BellRing size={22} />}
              title="Alert escalation & response"
              description="Detect and route urgent events so the right people respond fast."
              bullets={[
                'Triage and status tracking for active alerts',
                'Escalation flows that match local protocols',
                'Evidence and audit-friendly records',
              ]}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <ServiceCard
              icon={<Smartphone size={22} />}
              title="Offline-first field operations"
              description="Keep working when connectivity drops—sync when it returns."
              bullets={[
                'PWA experience optimized for mobile',
                'Cached data and clear offline indicators',
                'Resilient UX for rural settings',
              ]}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <ServiceCard
              icon={<Cloud size={22} />}
              title="IoT telemetry ingestion"
              description="Support device data flows from the edge to the care team."
              bullets={[
                'MQTT-friendly ingestion patterns',
                'Event-driven alert generation',
                'End-to-end demo capability without hardware',
              ]}
            />
          </Grid>
          <Grid item xs={12} md={12}>
            <ServiceCard
              icon={<ClipboardList size={22} />}
              title="Implementation & onboarding"
              description="Get from pilot to operational use with a structured rollout."
              bullets={[
                'Environment setup, configuration, and training',
                'Workflow mapping and role onboarding',
                'Go-live support and handover documentation',
              ]}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 5, p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 950 }}>
                Want to see CHENGETO in action?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tell us about your program and we’ll schedule a guided demo.
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to="/contact"
              variant="contained"
              size="large"
              endIcon={<ArrowRight size={18} />}
              sx={{ borderRadius: 999, px: 3, fontWeight: 900 }}
            >
              Contact us
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default ServicesPage;

