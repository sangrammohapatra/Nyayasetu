import React, { useEffect, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";

import AnimatedPage from "../../components/ui/AnimatedPage";
import GlassCard from "../../components/ui/GlassCard";
import GradientHeading from "../../components/ui/GradientHeading";
import api from "../../services/api";
import { RADIUS, TYPOGRAPHY } from "../../theme/tokens";

const STATUS_META = {
  drafted:             { label: "Drafted",           bg: "rgba(97,97,97,0.1)",    color: "#616161" },
  filed:               { label: "Filed",             bg: "rgba(25,118,210,0.1)",  color: "#1976d2" },
  response_received:   { label: "Response Received", bg: "rgba(46,125,50,0.1)",   color: "#2e7d32" },
  first_appeal_due:    { label: "Appeal Due",        bg: "rgba(230,81,0,0.1)",    color: "#e65100" },
  first_appeal_filed:  { label: "Appeal Filed",      bg: "rgba(106,27,154,0.1)", color: "#6a1b9a" },
  second_appeal_filed: { label: "2nd Appeal",        bg: "rgba(173,20,87,0.1)",  color: "#ad1457" },
  closed:              { label: "Closed",            bg: "rgba(27,94,32,0.1)",    color: "#1b5e20" },
  withdrawn:           { label: "Withdrawn",         bg: "rgba(117,117,117,0.1)", color: "#757575" },
};

function StatusChip({ status }) {
  const m = STATUS_META[status] || { label: status, bg: "rgba(97,97,97,0.1)", color: "#616161" };
  return (
    <Chip
      label={m.label}
      size="small"
      sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, background: m.bg, color: m.color, border: "none" }}
    />
  );
}

function deadlineInfo(dateStr) {
  if (!dateStr) return { label: "—", color: "var(--color-text-secondary)", fontWeight: 400 };
  const diff = Math.round((new Date(dateStr) - Date.now()) / 86400000);
  const label = new Date(dateStr).toLocaleDateString("en-IN", { dateStyle: "medium" });
  if (diff < 0)  return { label: `${label} (${Math.abs(diff)}d overdue)`, color: "#d32f2f", fontWeight: 700 };
  if (diff < 7)  return { label: `${label} (${diff}d left)`,             color: "#e65100", fontWeight: 600 };
  if (diff < 15) return { label,                                          color: "#f9a825", fontWeight: 500 };
  return { label, color: "var(--color-text)", fontWeight: 400 };
}

/* ── RTI Detail Drawer ──────────────────────────────────────────────────────── */
function RTIDetail({ rti, onClose, onExtended }) {
  const [extending, setExtending] = useState(false);
  const [extDays, setExtDays]     = useState("");
  const [extReason, setExtReason] = useState("");
  const [loading, setLoading]     = useState(false);
  const [snack, setSnack]         = useState({ open: false, message: "", severity: "success" });

  if (!rti) return null;

  const dl = deadlineInfo(rti.responseDeadline);
  const canExtend = !["closed", "withdrawn"].includes(rti.status);

  const handleExtend = async () => {
    const d = parseInt(extDays, 10);
    if (!d || d < 1 || d > 90) {
      setSnack({ open: true, message: "Enter a number between 1 and 90", severity: "error" });
      return;
    }
    setLoading(true);
    try {
      await api.patch(`/admin/rti/${rti._id}/extend-deadline`, {
        days: d,
        ...(extReason && { reason: extReason }),
      });
      setSnack({ open: true, message: `Deadline extended by ${d} day(s).`, severity: "success" });
      setExtending(false);
      setExtDays("");
      setExtReason("");
      onExtended();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || "Extension failed.", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const infoRows = [
    ["Reference No.", rti.referenceNumber || "—"],
    ["Gov Level", rti.govLevel || "—"],
    ["Ministry", rti.ministry || "—"],
    ["Department", rti.department || "—"],
    [
      "Filed Date",
      rti.filedDate
        ? new Date(rti.filedDate).toLocaleDateString("en-IN", { dateStyle: "medium" })
        : "—",
    ],
    ["AI Drafted", rti.aiDrafted ? "Yes" : "No"],
    [
      "Created",
      rti.createdAt
        ? new Date(rti.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })
        : "—",
    ],
  ];

  return (
    <Box sx={{ width: { xs: "100vw", sm: 440 }, p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
          RTI Application
        </GradientHeading>
        <IconButton onClick={onClose} size="small">✕</IconButton>
      </Box>
      <Divider sx={{ mb: 2, borderColor: "var(--color-border)" }} />

      <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--color-text)", mb: 1.5, lineHeight: 1.4 }}>
        {rti.title}
      </Typography>

      {rti.user && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <Box sx={{
            width: 34, height: 34, borderRadius: "50%",
            background: "var(--color-primary-alpha)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "var(--color-primary)", flexShrink: 0,
          }}>
            {rti.user.name?.[0]?.toUpperCase() || "?"}
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>{rti.user.name}</Typography>
            <Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>{rti.user.email}</Typography>
          </Box>
        </Box>
      )}

      {/* Status + Deadline highlighted row */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="caption" sx={{ color: "var(--color-text-secondary)", fontWeight: 600, display: "block", mb: 0.4 }}>
            Status
          </Typography>
          <StatusChip status={rti.status} />
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: "var(--color-text-secondary)", fontWeight: 600, display: "block", mb: 0.4 }}>
            Response Deadline
          </Typography>
          <Typography variant="caption" sx={{ color: dl.color, fontWeight: dl.fontWeight }}>
            {dl.label}
          </Typography>
        </Box>
      </Box>

      {infoRows.map(([label, value]) => (
        <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: 0.75, borderBottom: "1px solid var(--color-border)" }}>
          <Typography variant="caption" sx={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--color-text)", fontWeight: 500, textAlign: "right", maxWidth: "58%" }}>
            {String(value)}
          </Typography>
        </Box>
      ))}

      {/* Extend deadline UI */}
      {canExtend && (
        <Box sx={{ mt: 2.5 }}>
          {!extending ? (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setExtending(true)}
              sx={{ borderRadius: `${RADIUS.md}px`, textTransform: "none", fontWeight: 600 }}
            >
              Extend Deadline
            </Button>
          ) : (
            <Box sx={{
              display: "flex", flexDirection: "column", gap: 1.5, p: 2,
              borderRadius: 2, border: "1px solid var(--color-border)", background: "var(--color-bg)",
            }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Extend Response Deadline</Typography>
              <TextField
                size="small"
                label="Days to extend (1–90)"
                type="number"
                value={extDays}
                onChange={(e) => setExtDays(e.target.value)}
                inputProps={{ min: 1, max: 90 }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` } }}
              />
              <TextField
                size="small"
                label="Reason (optional)"
                value={extReason}
                onChange={(e) => setExtReason(e.target.value)}
                multiline
                rows={2}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` } }}
              />
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  onClick={() => { setExtending(false); setExtDays(""); setExtReason(""); }}
                  sx={{ textTransform: "none" }}
                >
                  Cancel
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleExtend}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={12} /> : null}
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: `${RADIUS.md}px` }}
                >
                  Apply Extension
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

/* ── Summary banner ─────────────────────────────────────────────────────────── */
function SummaryBanner({ summary }) {
  if (!summary) return null;
  const { overdueCount = 0, byStatus = {} } = summary;
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 2 }}>
      {overdueCount > 0 && (
        <Chip
          label={`⚠ ${overdueCount} overdue`}
          size="small"
          sx={{ fontWeight: 700, background: "rgba(211,47,47,0.12)", color: "#d32f2f", border: "none" }}
        />
      )}
      {Object.entries(byStatus).map(([s, count]) => {
        const m = STATUS_META[s];
        if (!m || !count) return null;
        return (
          <Chip
            key={s}
            label={`${m.label}: ${count}`}
            size="small"
            sx={{ fontWeight: 600, background: m.bg, color: m.color, border: "none", fontSize: "0.68rem" }}
          />
        );
      })}
    </Box>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────────── */
export default function AdminRTI() {
  const [applications, setApplications] = useState([]);
  const [total, setTotal]               = useState(0);
  const [summary, setSummary]           = useState(null);
  const [page, setPage]                 = useState(0);
  const [rowsPerPage, setRowsPerPage]   = useState(20);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [search, setSearch]             = useState("");
  const [status, setStatus]             = useState("");
  const [govLevel, setGovLevel]         = useState("");
  const [overdue, setOverdue]           = useState(false);
  const [selected, setSelected]         = useState(null);

  const fetchRTI = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: page + 1,
      limit: rowsPerPage,
      ...(search   && { search }),
      ...(status   && { status }),
      ...(govLevel && { govLevel }),
      ...(overdue  && { overdue: "true" }),
    });
    api
      .get(`/admin/rti?${params}`)
      .then(({ data }) => {
        setApplications(data.applications || []);
        setTotal(data.total || 0);
        setSummary(data.summary || null);
      })
      .catch((err) => setError(err.response?.data?.message || "Failed to load RTI applications"))
      .finally(() => setLoading(false));
  }, [page, rowsPerPage, search, status, govLevel, overdue]);

  useEffect(() => { fetchRTI(); }, [fetchRTI]);

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: "auto" }}>
        <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 0.5 }}>
          📋 RTI Dashboard
        </GradientHeading>
        <Typography variant="body2" sx={{ color: "var(--color-text-secondary)", mb: 3 }}>
          Platform-wide RTI filings — sorted by nearest deadline first
        </Typography>

        {/* Filters + Summary */}
        <GlassCard sx={{ p: 2, mb: 2 }}>
          <SummaryBanner summary={summary} />
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              size="small"
              placeholder="Search title, ref no, user…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ flex: "1 1 200px", "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` } }}
            />
            <FormControl size="small" sx={{ minWidth: 148 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(0); }}
                sx={{ borderRadius: `${RADIUS.md}px` }}
              >
                <MenuItem value="">All</MenuItem>
                {Object.entries(STATUS_META).map(([key, m]) => (
                  <MenuItem key={key} value={key}>{m.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Gov Level</InputLabel>
              <Select
                label="Gov Level"
                value={govLevel}
                onChange={(e) => { setGovLevel(e.target.value); setPage(0); }}
                sx={{ borderRadius: `${RADIUS.md}px` }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="central">Central</MenuItem>
                <MenuItem value="state">State</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={overdue}
                  onChange={(e) => { setOverdue(e.target.checked); setPage(0); }}
                  color="error"
                  size="small"
                />
              }
              label={<Typography variant="caption" sx={{ fontWeight: 600 }}>Overdue only</Typography>}
            />
          </Box>
        </GlassCard>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
        )}

        <GlassCard sx={{ overflow: "hidden" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{
                  "& th": {
                    fontWeight: 700, color: "var(--color-text-secondary)",
                    fontSize: "0.75rem", background: "var(--color-surface)",
                    borderBottom: "1px solid var(--color-border)",
                  },
                }}>
                  <TableCell>Title</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>Ministry</TableCell>
                  <TableCell>Response Deadline</TableCell>
                  <TableCell>Filed By</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><Skeleton variant="text" height={20} /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : applications.map((a) => {
                      const dl = deadlineInfo(a.responseDeadline);
                      return (
                        <TableRow
                          key={a._id}
                          hover
                          onClick={() => setSelected(a)}
                          sx={{ cursor: "pointer", "& td": { borderBottom: "1px solid var(--color-border)", py: 1 } }}
                        >
                          <TableCell sx={{ maxWidth: 200 }}>
                            <Typography variant="body2" sx={{
                              fontWeight: 600, color: "var(--color-text)",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {a.title}
                            </Typography>
                          </TableCell>
                          <TableCell><StatusChip status={a.status} /></TableCell>
                          <TableCell>
                            <Chip
                              label={a.govLevel || "—"}
                              size="small"
                              sx={{
                                height: 18, fontSize: "0.65rem", fontWeight: 600, border: "none",
                                background: a.govLevel === "central" ? "rgba(25,118,210,0.08)" : "rgba(46,125,50,0.08)",
                                color:      a.govLevel === "central" ? "#1976d2"               : "#2e7d32",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>
                              {a.ministry ? a.ministry.replace(/_/g, " ") : "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: dl.color, fontWeight: dl.fontWeight }}>
                              {dl.label}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>
                              {a.user?.name || "—"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>
                              {a.createdAt ? new Date(a.createdAt).toLocaleDateString("en-IN") : "—"}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {!loading && applications.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>
                        No RTI applications found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
            sx={{ borderTop: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
          />
        </GlassCard>
      </Box>

      <Drawer
        anchor="right"
        open={!!selected}
        onClose={() => setSelected(null)}
        PaperProps={{ sx: { background: "var(--color-surface)" } }}
      >
        <RTIDetail
          rti={selected}
          onClose={() => setSelected(null)}
          onExtended={() => { setSelected(null); fetchRTI(); }}
        />
      </Drawer>
    </AnimatedPage>
  );
}
