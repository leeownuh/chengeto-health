/**
 * CHENGETO - FAQ
 */

import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Divider, Stack, Typography } from '@mui/material';
import { ArrowRight } from 'lucide-react';

const QA = ({ q, a }) => (
  <Stack spacing={0.75}>
    <Typography variant="subtitle1" sx={{ fontWeight: 980 }}>
      {q}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {a}
    </Typography>
    <Divider sx={{ mt: 2 }} />
  </Stack>
);

const FAQPage = () => {
  return (
    <Box sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="md">
        <Stack spacing={1} sx={{ mb: 3 }}>
          <Typography variant="h3" sx={{ fontWeight: 980 }}>
            FAQ
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Common questions from families in diaspora and elders in Zimbabwe.
          </Typography>
        </Stack>

        <Stack spacing={2.5}>
          <QA
            q="Do you cover all of Zimbabwe?"
            a="Yes. We support elders across Zimbabwe. Some visit frequency may vary by location; we confirm before signup."
          />
          <QA
            q="Do you need the elder’s consent?"
            a="Yes. We prioritize dignity and consent. We explain the service and confirm who is allowed to receive updates."
          />
          <QA
            q="How do updates work?"
            a="We send updates after check-ins/visits and provide a monthly summary. Updates go only to approved family contacts."
          />
          <QA
            q="What happens in an emergency?"
            a="We escalate quickly, coordinate next steps, and keep the family informed. Specific actions depend on the situation and local availability."
          />
          <QA
            q="Can I pay in USD or ZWL?"
            a="Yes. USD is supported for diaspora. ZWL totals are confirmed at signup because exchange rates change."
          />
          <QA
            q="Can I support more than one elder?"
            a="Yes. We can set up multiple elders under one family account and customize schedules."
          />
        </Stack>

        <Box sx={{ mt: 4, p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Stack spacing={0.5}>
              <Typography variant="h6" sx={{ fontWeight: 980 }}>
                Still have questions?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tell us where the elder lives and what support you want.
              </Typography>
            </Stack>
            <Button component={RouterLink} to="/contact" variant="contained" endIcon={<ArrowRight size={18} />} sx={{ borderRadius: 999, px: 3, fontWeight: 950 }}>
              Contact us
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default FAQPage;

