import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography
} from '@mui/material';
import { Shield, Verified, ErrorOutline } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';

const statusTone = (overallStatus) => {
  switch (overallStatus) {
    case 'verified':
      return { label: 'Verified', color: 'success', icon: <Verified fontSize="small" /> };
    case 'offchain_mismatch':
      return { label: 'Mismatch (Off-chain)', color: 'error', icon: <ErrorOutline fontSize="small" /> };
    case 'onchain_mismatch':
      return { label: 'Mismatch (On-chain)', color: 'error', icon: <ErrorOutline fontSize="small" /> };
    case 'not_anchored':
      return { label: 'Not anchored', color: 'warning', icon: <ErrorOutline fontSize="small" /> };
    case 'chain_unavailable':
      return { label: 'Chain unavailable', color: 'warning', icon: <ErrorOutline fontSize="small" /> };
    default:
      return { label: 'Unknown', color: 'default', icon: <Shield fontSize="small" /> };
  }
};

const HashLine = ({ label, value }) => {
  if (!value) return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
        {value}
      </Typography>
    </Box>
  );
};

export default function IntegrityVerifier({ entityType, id, dense = false }) {
  const { api } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const tone = useMemo(() => statusTone(result?.overallStatus), [result?.overallStatus]);

  const handleVerify = async () => {
    try {
      setLoading(true);
      const response = await api.post('/blockchain/verify', { entityType, id });
      const payload = response.data?.data;
      setResult(payload);
      setOpen(true);
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'Blockchain integrity verification failed', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size={dense ? 'small' : 'medium'}
        variant="outlined"
        startIcon={loading ? <CircularProgress size={16} /> : <Shield />}
        onClick={handleVerify}
        disabled={loading}
      >
        Verify integrity
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Blockchain integrity check
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {entityType}:{id}
            </Typography>
          </Box>
          <Chip icon={tone.icon} label={tone.label} color={tone.color} variant={tone.color === 'default' ? 'outlined' : 'filled'} />
        </DialogTitle>
        <DialogContent>
          {!result ? (
            <Typography variant="body2" color="text.secondary">
              No verification result available.
            </Typography>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Off-chain hash match
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {result.offChainCheck?.checked
                    ? (result.offChainCheck?.matches ? 'Anchor payload matches stored hash.' : 'Anchor payload does NOT match stored hash.')
                    : (result.offChainCheck?.reason || 'Off-chain check not available.')}
                </Typography>
                <Box sx={{ mt: 1, display: 'grid', gap: 1 }}>
                  <HashLine label="Expected dataHash" value={result.offChainCheck?.expectedDataHash} />
                  <HashLine label="Stored dataHash" value={result.offChainCheck?.storedDataHash} />
                </Box>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  On-chain verification
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {result.chainCheck?.checked
                    ? (result.chainCheck?.verified ? 'Chain event hash matches.' : 'Chain event hash does NOT match.')
                    : (result.chainCheck?.reason || 'On-chain check not available.')}
                </Typography>
                <Box sx={{ mt: 1, display: 'grid', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Chain mode: {result.chainCheck?.mode || 'unknown'}
                  </Typography>
                  <HashLine label="EventId" value={result.chainCheck?.eventId} />
                  <HashLine label="EventHash" value={result.chainCheck?.eventHash} />
                  <HashLine label="On-chain dataHash" value={result.chainCheck?.onChainDataHash} />
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

