/**
 * CHENGETO - For elders
 */

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { ArrowRight, HeartHandshake, ShieldCheck, Smile, UserCheck } from 'lucide-react';

const PromiseCard = ({ icon, title, description }) => (
  <Card variant="outlined" sx={{ height: '100%', borderRadius: 4 }}>
    <CardContent sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Box sx={{ color: 'primary.main', display: 'inline-flex' }}>{icon}</Box>
        <Typography variant="h6" sx={{ fontWeight: 980 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Stack>
    </CardContent>
  </Card>
);

const EldersPage = () => {
  return (
    <Box sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 980 }}>
            For elders
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 920 }}>
            CHENGETO is support that respects dignity. We check in, listen, and help coordinate care—while keeping the elder in control.
          </Typography>
        </Stack>

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={3}>
            <PromiseCard
              icon={<UserCheck size={22} />}
              title="Consent first"
              description="We ask permission and explain what we’re doing. The elder can stop or change the plan at any time."
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <PromiseCard
              icon={<HeartHandshake size={22} />}
              title="Respectful care"
              description="We communicate kindly and clearly, and we follow cultural norms and family preferences."
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <PromiseCard
              icon={<ShieldCheck size={22} />}
              title="Privacy protected"
              description="We share updates only with the family members approved by the elder (or guardian where applicable)."
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <PromiseCard
              icon={<Smile size={22} />}
              title="Practical help"
              description="From reminders to visits and clinic coordination—we focus on what helps day-to-day."
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 5, p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Stack spacing={0.5}>
              <Typography variant="h6" sx={{ fontWeight: 980 }}>
                Want to enroll an elder?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start with a plan, then we confirm consent and set the schedule.
              </Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button component={RouterLink} to="/pricing" variant="contained" sx={{ borderRadius: 999, px: 3, fontWeight: 950 }} endIcon={<ArrowRight size={18} />}>
                Pricing
              </Button>
              <Button component={RouterLink} to="/contact" variant="outlined" sx={{ borderRadius: 999, px: 3, fontWeight: 950 }}>
                Contact
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default EldersPage;

