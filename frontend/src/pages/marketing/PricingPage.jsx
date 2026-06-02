/**
 * CHENGETO - Plans & Pricing
 * Care subscriptions for elders in Zimbabwe (USD + optional ZWL estimates).
 */

import React, { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

const formatMoney = (amount, currency) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
};

const buildPlans = () => ([
  {
    id: 'essential',
    name: 'Essential',
    usd: 25,
    tagline: 'Light support + reliable updates',
    includes: [
      'Weekly wellbeing check-in (call/WhatsApp)',
      'Medication reminders (basic)',
      'Monthly family summary',
      'Care coordination via WhatsApp/email',
    ],
    goodFor: 'Independent elders who need consistent check-ins.',
  },
  {
    id: 'standard',
    name: 'Standard',
    usd: 49,
    badge: 'Most popular',
    tagline: 'Balanced plan for most families',
    includes: [
      '2× weekly check-ins (call/WhatsApp)',
      'Monthly home visit (where available)',
      'Vitals check during visits (basic)',
      'Family updates after each visit',
      'Clinic coordination (appointments, follow-up)',
    ],
    goodFor: 'Elders with ongoing needs or chronic conditions.',
  },
  {
    id: 'premium',
    name: 'Premium',
    usd: 99,
    tagline: 'Highest-touch support',
    includes: [
      '3× weekly check-ins (call/WhatsApp)',
      '2× home visits per month (where available)',
      'Priority escalation coordination for urgent issues',
      'Monthly care plan review with family',
      'Detailed monthly report',
    ],
    goodFor: 'Higher-risk elders or families wanting frequent updates.',
  },
]);

const Price = ({ usd, currency, fxZwlPerUsd }) => {
  if (currency === 'USD') {
    return <>{formatMoney(usd, 'USD')}/mo</>;
  }

  if (!fxZwlPerUsd) {
    return <>ZWL —/mo</>;
  }

  const zwl = usd * fxZwlPerUsd;
  return <>{formatMoney(zwl, 'ZWL')}/mo</>;
};

const PricingPage = () => {
  const [currency, setCurrency] = useState('USD');
  const fxZwlPerUsd = useMemo(() => {
    const raw = String(import.meta.env.VITE_PUBLIC_ZWL_PER_USD || '').trim();
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, []);

  const plans = useMemo(() => buildPlans(), []);

  return (
    <Box sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Stack spacing={1} sx={{ mb: 3 }}>
          <Typography variant="h3" sx={{ fontWeight: 980 }}>
            Plans & pricing
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 900 }}>
            Subscriptions for families (including diaspora) who want consistent support and clear updates for an elder in
            Zimbabwe.
          </Typography>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 3 }}>
          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 900 }}>
              Choose currency
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ZWL amounts are estimates (rates change). Final ZWL totals are confirmed at signup.
            </Typography>
          </Stack>
          <ToggleButtonGroup
            value={currency}
            exclusive
            onChange={(_, next) => next && setCurrency(next)}
            size="small"
            sx={{ borderRadius: 999 }}
          >
            <ToggleButton value="USD" sx={{ borderRadius: 999, px: 2.5, fontWeight: 900 }}>
              USD
            </ToggleButton>
            <ToggleButton value="ZWL" sx={{ borderRadius: 999, px: 2.5, fontWeight: 900 }}>
              ZWL
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {!fxZwlPerUsd && currency === 'ZWL' && (
          <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
            ZWL estimates are not configured yet. Set <Box component="span" sx={{ fontWeight: 900 }}>VITE_PUBLIC_ZWL_PER_USD</Box> to show
            approximate ZWL prices.
          </Alert>
        )}

        <Grid container spacing={2.5} alignItems="stretch">
          {plans.map((plan) => (
            <Grid key={plan.id} item xs={12} md={4}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  borderRadius: 4,
                  position: 'relative',
                  borderColor: plan.badge ? 'primary.main' : 'divider',
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="h6" sx={{ fontWeight: 980 }}>
                        {plan.name}
                      </Typography>
                      {plan.badge && <Chip label={plan.badge} color="primary" size="small" />}
                    </Stack>

                    <Typography variant="h4" sx={{ fontWeight: 980, letterSpacing: -0.5 }}>
                      <Price usd={plan.usd} currency={currency} fxZwlPerUsd={fxZwlPerUsd} />
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                      {plan.tagline}
                    </Typography>

                    <Divider />

                    <Stack component="ul" spacing={1} sx={{ pl: 0, m: 0, listStyle: 'none' }}>
                      {plan.includes.map((item) => (
                        <Stack key={item} component="li" direction="row" spacing={1} alignItems="flex-start">
                          <Box sx={{ pt: '2px', color: 'primary.main' }}>
                            <CheckCircle2 size={18} />
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {item}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>

                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover' }}>
                      <Typography variant="caption" color="text.secondary">
                        <Box component="span" sx={{ fontWeight: 900, color: 'text.primary' }}>
                          Good for:
                        </Box>{' '}
                        {plan.goodFor}
                      </Typography>
                    </Box>

                    <Button
                      component={RouterLink}
                      to="/contact"
                      variant={plan.badge ? 'contained' : 'outlined'}
                      endIcon={<ArrowRight size={18} />}
                      sx={{ borderRadius: 999, px: 3, fontWeight: 950 }}
                    >
                      Get started
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 4 }}>
          <Alert severity="success" icon={<ShieldCheck size={18} />} variant="outlined">
            All plans include respectful care, consent-based check-ins, and privacy-first communication.
          </Alert>
        </Box>

        <Box sx={{ mt: 4, p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Stack spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 980 }}>
              Add-ons (optional)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Extra home visits, transport support, and special requests can be arranged. Share details on the contact form and we’ll quote in USD/ZWL.
            </Typography>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default PricingPage;

