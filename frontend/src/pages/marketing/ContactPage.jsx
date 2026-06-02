/**
 * CHENGETO - Contact
 */

import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Mail, Phone, Send } from 'lucide-react';

const DEFAULT_CONTACT_EMAIL = 'contact@chengeto.health';
const DEFAULT_CONTACT_PHONE = '';
const DEFAULT_CONTACT_WHATSAPP = '';

const ContactPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      organization: '',
      message: '',
    },
  });

  const contactEmail = useMemo(
    () => import.meta.env.VITE_PUBLIC_CONTACT_EMAIL || DEFAULT_CONTACT_EMAIL,
    []
  );
  const contactPhone = useMemo(
    () => import.meta.env.VITE_PUBLIC_CONTACT_PHONE || DEFAULT_CONTACT_PHONE,
    []
  );
  const contactWhatsApp = useMemo(
    () => import.meta.env.VITE_PUBLIC_CONTACT_WHATSAPP || DEFAULT_CONTACT_WHATSAPP,
    []
  );

  const onSubmit = async (values) => {
    const subject = encodeURIComponent('CHENGETO subscription inquiry');
    const body = encodeURIComponent(
      `Name: ${values.name}\nEmail: ${values.email}\nOrganization: ${values.organization}\n\n${values.message}`.trim()
    );

    // Client-only fallback: open email composer (works in any static deployment).
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;

    setSubmitted(true);
    reset();
  };

  return (
    <Box sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <Typography variant="h3" sx={{ fontWeight: 950 }}>
                Contact
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Tell us who you want to support (and where in Zimbabwe). We’ll recommend a plan and confirm coverage.
              </Typography>
            </Stack>

            <Card variant="outlined" sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Mail size={18} />
                    <Typography variant="body2">
                      <Box component="span" sx={{ fontWeight: 800 }}>
                        Email:
                      </Box>{' '}
                      {contactEmail}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Phone size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Phone: {contactPhone || '—'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      WhatsApp: {contactWhatsApp || '—'}
                    </Typography>
                  </Stack>
                  <Alert severity="info" variant="outlined">
                    This form opens your email app so CHENGETO can be hosted as a static site without extra backend work.
                  </Alert>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            <Card variant="outlined" sx={{ borderRadius: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2}>
                  {submitted && (
                    <Alert severity="success" onClose={() => setSubmitted(false)}>
                      Thanks — your email client should open. If it didn’t, please email {contactEmail}.
                    </Alert>
                  )}

                  <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="Your name"
                          fullWidth
                          error={Boolean(errors.name)}
                          helperText={errors.name?.message}
                          {...register('name', { required: 'Name is required' })}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="Email"
                          fullWidth
                          error={Boolean(errors.email)}
                          helperText={errors.email?.message}
                          {...register('email', {
                            required: 'Email is required',
                            pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
                          })}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Elder location in Zimbabwe (optional)"
                          fullWidth
                          {...register('organization')}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="What do you need help with?"
                          fullWidth
                          multiline
                          minRows={5}
                          error={Boolean(errors.message)}
                          helperText={errors.message?.message}
                          {...register('message', { required: 'Please add a short message' })}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Button
                          type="submit"
                          variant="contained"
                          size="large"
                          startIcon={<Send size={18} />}
                          disabled={isSubmitting}
                          sx={{ borderRadius: 999, px: 3, fontWeight: 900 }}
                        >
                          Send
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default ContactPage;
