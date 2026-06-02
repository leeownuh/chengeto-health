/**
 * CHENGETO - For diaspora
 */

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { ArrowRight, MessageCircle, PhoneCall, ShieldCheck, TrendingUp } from 'lucide-react';

const Highlight = ({ icon, title, description }) => (
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

const DiasporaPage = () => {
  return (
    <Box sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 980 }}>
            For families in diaspora
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 920 }}>
            You want to help—but time zones, distance, and uncertainty make it hard. CHENGETO gives you consistent check-ins and clear updates for an elder in Zimbabwe.
          </Typography>
        </Stack>

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={4}>
            <Highlight
              icon={<MessageCircle size={22} />}
              title="Updates that reduce anxiety"
              description="Receive updates after check-ins and visits, plus monthly summaries the whole family can share."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Highlight
              icon={<PhoneCall size={22} />}
              title="Care that actually happens"
              description="We schedule and complete check-ins and visits, then tell you what we found and what we did."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Highlight
              icon={<TrendingUp size={22} />}
              title="A simple, repeatable routine"
              description="No last-minute panic. A predictable plan means fewer crises and faster action when something changes."
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 5, p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Stack spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 980 }}>
              What we ask from you
            </Typography>
            <Typography variant="body2" color="text.secondary">
              A phone number for the elder (or caregiver), location in Zimbabwe, preferred language, consent, and who should receive updates.
            </Typography>
          </Stack>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Card variant="outlined" sx={{ borderRadius: 4 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
                <Stack spacing={0.5}>
                  <Typography variant="h6" sx={{ fontWeight: 980 }}>
                    Ready to subscribe?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Choose a plan, then we onboard your family and start check-ins.
                  </Typography>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button component={RouterLink} to="/pricing" variant="contained" sx={{ borderRadius: 999, px: 3, fontWeight: 950 }} endIcon={<ArrowRight size={18} />}>
                    Pricing
                  </Button>
                  <Button component={RouterLink} to="/contact" variant="outlined" sx={{ borderRadius: 999, px: 3, fontWeight: 950 }}>
                    Talk to us
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="caption" color="text.secondary">
            <Box component="span" sx={{ fontWeight: 900, color: 'text.primary' }}>
              Note:
            </Box>{' '}
            We prioritize consent, privacy, and respectful communication. No surprises.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default DiasporaPage;

