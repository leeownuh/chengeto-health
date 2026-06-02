/**
 * CHENGETO - Marketing Home (Care services)
 */

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Chip, Container, Grid, Stack, Typography } from '@mui/material';
import { ArrowRight, BellRing, HeartHandshake, Home, MessageCircle, ShieldCheck, Stethoscope } from 'lucide-react';

const BenefitCard = ({ icon, title, description }) => (
  <Card variant="outlined" sx={{ height: '100%', borderRadius: 4 }}>
    <CardContent sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Box sx={{ color: 'primary.main', display: 'inline-flex' }}>{icon}</Box>
        <Typography variant="h6" sx={{ fontWeight: 950 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Stack>
    </CardContent>
  </Card>
);

const HomePage = () => {
  return (
    <Box>
      <Box
        sx={{
          py: { xs: 7, md: 10 },
          background:
            'radial-gradient(1200px 600px at 15% 0%, rgba(37,99,235,0.22), transparent 60%), radial-gradient(900px 500px at 90% 25%, rgba(59,130,246,0.18), transparent 55%)',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label="Care coverage across Zimbabwe" color="primary" variant="outlined" />
                  <Chip label="Subscriptions for families in diaspora" color="primary" variant="outlined" />
                  <Chip label="Calls, visits, and updates" color="primary" variant="outlined" />
                </Stack>

                <Typography variant="h2" sx={{ fontWeight: 980, letterSpacing: -1.2, lineHeight: 1.05 }}>
                  Support your parents in Zimbabwe, even when you’re abroad.
                </Typography>

                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 760 }}>
                  CHENGETO is a care service: regular check-ins, home visits when needed, clinic coordination, and fast
                  escalation—plus clear updates for the family.
                </Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
                  <Button
                    component={RouterLink}
                    to="/pricing"
                    variant="contained"
                    size="large"
                    endIcon={<ArrowRight size={18} />}
                    sx={{ borderRadius: 999, px: 3, fontWeight: 950 }}
                  >
                    View plans & pricing
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/contact"
                    variant="outlined"
                    size="large"
                    sx={{ borderRadius: 999, px: 3, fontWeight: 950 }}
                  >
                    Talk to a care coordinator
                  </Button>
                </Stack>

                <Typography variant="caption" color="text.secondary">
                  Ideal for families in diaspora looking for trusted, on-the-ground support and reliable updates.
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} md={5}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                  background:
                    'linear-gradient(135deg, rgba(30,58,138,0.94) 0%, rgba(37,99,235,0.86) 45%, rgba(59,130,246,0.78) 100%)',
                  color: 'white',
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Stack spacing={2.25}>
                    <Typography variant="h5" sx={{ fontWeight: 980 }}>
                      What you get
                    </Typography>
                    <Stack spacing={1.25}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <MessageCircle size={18} />
                        <Typography variant="body2" sx={{ opacity: 0.95 }}>
                          Regular check-ins (calls/WhatsApp) and family updates
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Home size={18} />
                        <Typography variant="body2" sx={{ opacity: 0.95 }}>
                          Home visits when needed, with notes you can trust
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Stethoscope size={18} />
                        <Typography variant="body2" sx={{ opacity: 0.95 }}>
                          Vitals checks, medication reminders, and clinic coordination
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <BellRing size={18} />
                        <Typography variant="body2" sx={{ opacity: 0.95 }}>
                          Fast escalation for emergencies and urgent concerns
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <ShieldCheck size={18} />
                        <Typography variant="body2" sx={{ opacity: 0.95 }}>
                          Privacy, consent, and respectful care
                        </Typography>
                      </Stack>
                    </Stack>

                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 4,
                        bgcolor: 'rgba(255,255,255,0.12)',
                        border: '1px solid rgba(255,255,255,0.18)',
                      }}
                    >
                      <Typography variant="caption" sx={{ opacity: 0.92 }}>
                        Coverage: Zimbabwe (all provinces). Plans scale for one elder or multiple.
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box sx={{ py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900 }}>
              Peace of mind, delivered
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 980 }}>
              Care services built for families who can’t be there every day
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 860 }}>
              Whether you live in Harare, Johannesburg, London, or New York—CHENGETO keeps you connected with reliable
              check-ins, practical support, and clear communication.
            </Typography>
          </Stack>

          <Grid container spacing={2.5}>
            <Grid item xs={12} md={4}>
              <BenefitCard
                icon={<HeartHandshake size={22} />}
                title="Trusted local support"
                description="We coordinate on-the-ground care and follow-ups, with accountability and a clear plan."
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <BenefitCard
                icon={<MessageCircle size={22} />}
                title="Updates you can rely on"
                description="Regular summaries and updates after check-ins and visits—so the whole family stays informed."
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <BenefitCard
                icon={<BellRing size={22} />}
                title="Escalation when it matters"
                description="When something looks wrong, we escalate quickly and coordinate next steps with your approval."
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 5, p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 980 }}>
                  Ready to support an elder in Zimbabwe?
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose a plan, then we onboard your family and set up the check-in schedule.
                </Typography>
              </Box>
              <Button
                component={RouterLink}
                to="/pricing"
                variant="contained"
                size="large"
                endIcon={<ArrowRight size={18} />}
                sx={{ borderRadius: 999, px: 3, fontWeight: 950 }}
              >
                See pricing
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default HomePage;
