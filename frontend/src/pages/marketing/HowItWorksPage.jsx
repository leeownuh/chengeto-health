/**
 * CHENGETO - How it works
 */

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { ArrowRight, CalendarCheck, ClipboardList, PhoneCall, ShieldCheck, UserCheck } from 'lucide-react';

const StepCard = ({ icon, step, title, description }) => (
  <Card variant="outlined" sx={{ height: '100%', borderRadius: 4 }}>
    <CardContent sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ color: 'primary.main', display: 'inline-flex' }}>{icon}</Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900 }}>
            Step {step}
          </Typography>
        </Stack>
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

const HowItWorksPage = () => {
  return (
    <Box sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 980 }}>
            How it works
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 900 }}>
            Simple onboarding, clear schedules, and reliable updates—so your family knows what’s happening and what’s next.
          </Typography>
        </Stack>

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={4}>
            <StepCard
              step={1}
              icon={<ClipboardList size={22} />}
              title="Choose a plan"
              description="Pick a subscription based on how often you want check-ins and visits. We can tailor for multiple elders."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StepCard
              step={2}
              icon={<UserCheck size={22} />}
              title="Onboard the elder (with consent)"
              description="We confirm identity, consent, preferred language, medical context, and trusted family contacts."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StepCard
              step={3}
              icon={<CalendarCheck size={22} />}
              title="Set a check-in schedule"
              description="We agree on a routine and decide who receives updates (e.g., children, siblings, guardians)."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StepCard
              step={4}
              icon={<PhoneCall size={22} />}
              title="Check-ins and visits happen"
              description="We do calls/WhatsApp check-ins and organize visits when needed, recording outcomes and next actions."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <StepCard
              step={5}
              icon={<ShieldCheck size={22} />}
              title="Escalation when needed"
              description="If something looks urgent, we escalate quickly, coordinate next steps, and keep your family informed."
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 5, p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 980 }}>
                Want help picking the right plan?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tell us where the elder lives in Zimbabwe and what support you want.
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to="/contact"
              variant="contained"
              endIcon={<ArrowRight size={18} />}
              sx={{ borderRadius: 999, px: 3, fontWeight: 950 }}
            >
              Contact us
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default HowItWorksPage;

