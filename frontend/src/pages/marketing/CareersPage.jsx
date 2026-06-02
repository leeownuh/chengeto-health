/**
 * CHENGETO - Careers
 */

import React, { useMemo } from 'react';
import { Box, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { Briefcase, HeartHandshake, MapPin, Users } from 'lucide-react';

const DEFAULT_CAREERS_EMAIL = 'careers@chengeto.health';

const RoleCard = ({ title, location, type, description }) => (
  <Card variant="outlined" sx={{ height: '100%', borderRadius: 4 }}>
    <CardContent sx={{ p: 3 }}>
      <Stack spacing={1}>
        <Typography variant="h6" sx={{ fontWeight: 980 }}>
          {title}
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ color: 'text.secondary' }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <MapPin size={16} />
            <Typography variant="caption">{location}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Briefcase size={16} />
            <Typography variant="caption">{type}</Typography>
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Stack>
    </CardContent>
  </Card>
);

const CareersPage = () => {
  const careersEmail = useMemo(() => import.meta.env.VITE_PUBLIC_CAREERS_EMAIL || DEFAULT_CAREERS_EMAIL, []);

  return (
    <Box sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 980 }}>
            Careers
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 920 }}>
            Join a mission to support elders across Zimbabwe with respectful, reliable care.
          </Typography>
        </Stack>

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <HeartHandshake size={18} />
                    <Typography variant="h6" sx={{ fontWeight: 980 }}>
                      Values
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Dignity, consent, honesty, and accountability—especially when families are far away.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Users size={18} />
                    <Typography variant="h6" sx={{ fontWeight: 980 }}>
                      Who we hire
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Community health workers, nurses, care coordinators, and operations staff with strong communication skills.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={1.25}>
                  <Typography variant="h6" sx={{ fontWeight: 980 }}>
                    Apply
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Email your CV and a short note to <Box component="span" sx={{ fontWeight: 900, color: 'text.primary' }}>{careersEmail}</Box>.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 980, mb: 2 }}>
            Open roles (examples)
          </Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <RoleCard
                title="Community Health Worker (CHW)"
                location="Zimbabwe (multiple districts)"
                type="Field / Part-time or Full-time"
                description="Home visits, wellbeing checks, and family updates. Empathy and reliability are essential."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <RoleCard
                title="Care Coordinator"
                location="Zimbabwe (remote/office)"
                type="Full-time"
                description="Scheduling, family communication, escalation coordination, and quality follow-up."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <RoleCard
                title="Nurse (Community / Primary Care)"
                location="Zimbabwe (as available)"
                type="Contract"
                description="Clinical oversight, guidance on care plans, and escalation support when issues arise."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <RoleCard
                title="Customer Support (Diaspora)"
                location="Remote"
                type="Contract"
                description="Support family onboarding across time zones, answer plan questions, and keep communication clear."
              />
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};

export default CareersPage;

