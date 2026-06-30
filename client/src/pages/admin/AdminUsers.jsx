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
import Checkbox from "@mui/material/Checkbox";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";

import AnimatedPage from "../../components/ui/AnimatedPage";
import GlassCard from "../../components/ui/GlassCard";
import GradientHeading from "../../components/ui/GradientHeading";
import api from "../../services/api";
import { RADIUS, TYPOGRAPHY } from "../../theme/tokens";

const PERSONA_COLORS = {
  citizen: { bg: "rgba(25,118,210,0.1)",  color: "#1976d2" },
  lawyer:  { bg: "rgba(123,31,162,0.1)",  color: "#7b1fa2" },
  admin:   { bg: "rgba(211,47,47,0.1)",   color: "#d32f2f" },
};

const PLAN_COLORS = {
  free:         { bg: "rgba(97,97,97,0.1)",    color: "#616161" },
  basic:        { bg: "rgba(2,136,209,0.1)",   color: "#0288d1" },
  pro:          { bg: "rgba(46,125,50,0.1)",   color: "#2e7d32" },
  professional: { bg: "rgba(46,125,50,0.1)",   color: "#2e7d32" },
  firm:         { bg: "rgba(106,27,154,0.1)",  color: "#6a1b9a" },
};

function UserBadge({ label, colorMap }) {
  const c = colorMap[label] || colorMap.free;
  return (
    <Chip
      label={label}
      size="small"
      sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700, background: c?.bg, color: c?.color, border: "none" }}
    />
  );
}

/* ── User Detail Drawer ─────────────────────────────────────────────────────── */
function UserDetail({ userId, onClose, onRefresh }) {
  const [user, setUser]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Generic confirm dialog
  const [confirm, setConfirm] = useState({ open: false, action: null, title: "", body: "" });

  // Quota reset dialog
  const [quotaDialog, setQuotaDialog]       = useState(false);
  const [quotaType, setQuotaType]           = useState("all");
  const [docsLimitOverride, setDocsLimit]   = useState("");
  const [chatsLimitOverride, setChatsLimit] = useState("");
  const [quotaLoading, setQuotaLoading]     = useState(false);

  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const loadUser = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    api
      .get(`/admin/users/${userId}`)
      .then(({ data }) => setUser(data.user || data))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { loadUser(); }, [loadUser]);

  const openConfirm = (action, title, body) =>
    setConfirm({ open: true, action, title, body });
  const closeConfirm = () =>
    setConfirm({ open: false, action: null, title: "", body: "" });

  const handleConfirm = async () => {
    const action = confirm.action;
    closeConfirm();
    setActionLoading(true);
    try {
      if (action === "toggle") {
        await api.patch(`/admin/users/${userId}/toggle-active`);
        setSnack({
          open: true,
          message: `Account ${user.isActive ? "deactivated" : "activated"} successfully.`,
          severity: "success",
        });
      } else if (action === "revoke") {
        await api.post(`/admin/users/${userId}/revoke-subscription`);
        setSnack({ open: true, message: "Subscription revoked. User downgraded to free.", severity: "success" });
      }
      loadUser();
      onRefresh();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || "Action failed.", severity: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetQuota = async () => {
    setQuotaLoading(true);
    try {
      const overrides = {};
      if (docsLimitOverride)  overrides.docsLimit     = Number(docsLimitOverride);
      if (chatsLimitOverride) overrides.aiChatsLimit  = Number(chatsLimitOverride);
      await api.patch(`/admin/users/${userId}/reset-quota`, {
        quotaType,
        ...(Object.keys(overrides).length && { overrides }),
      });
      setSnack({ open: true, message: `Quota (${quotaType}) reset successfully.`, severity: "success" });
      setQuotaDialog(false);
      setDocsLimit("");
      setChatsLimit("");
      setQuotaType("all");
      loadUser();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.message || "Quota reset failed.", severity: "error" });
    } finally {
      setQuotaLoading(false);
    }
  };

  const isAdmin    = user?.persona?.toLowerCase() === "admin";
  const hasPaidPlan = user && user.plan && user.plan !== "free";

  return (
    <Box sx={{ width: { xs: "100vw", sm: 420 }, p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
          User Detail
        </GradientHeading>
        <IconButton onClick={onClose} size="small">✕</IconButton>
      </Box>
      <Divider sx={{ mb: 2, borderColor: "var(--color-border)" }} />

      {loading &&
        [1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="text" sx={{ mb: 1 }} height={24} />
        ))}

      {user && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* Avatar + name */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Box sx={{
              width: 52, height: 52, borderRadius: "50%",
              background: "var(--color-primary-alpha)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 700, color: "var(--color-primary)",
            }}>
              {user.name?.[0]?.toUpperCase() || "?"}
            </Box>
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>{user.name}</Typography>
              <Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>{user.email}</Typography>
            </Box>
          </Box>

          {/* Info rows */}
          {[
            ["Persona",        user.persona],
            ["Plan",           user.plan || "free"],
            ["Status",         user.isActive === false ? "Inactive" : "Active"],
            ["Phone",          user.phone || "—"],
            ["State",          user.state || "—"],
            ["Joined",         user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—"],
            ["Docs Generated", user.freeUsage?.docsGenerated ?? "—"],
            ["Docs Limit",     user.freeUsage?.docsLimit ?? "—"],
            ["AI Chats Used",  user.freeUsage?.aiChatsUsed ?? "—"],
            ["AI Chats Limit", user.freeUsage?.aiChatsLimit ?? "—"],
            ["Triage Used",    user.freeUsage?.triageUsed ?? "—"],
          ].map(([label, value]) => (
            <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: 0.5, borderBottom: "1px solid var(--color-border)" }}>
              <Typography variant="caption" sx={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>
                {label}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color:
                    label === "Status"
                      ? value === "Active" ? "#2e7d32" : "#d32f2f"
                      : "var(--color-text)",
                  fontWeight: 500,
                }}
              >
                {String(value)}
              </Typography>
            </Box>
          ))}

          {/* Actions */}
          {!isAdmin && (
            <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={user.isActive !== false}
                    onChange={() =>
                      openConfirm(
                        "toggle",
                        !user.isActive ? "Activate Account?" : "Deactivate Account?",
                        !user.isActive
                          ? `Re-enable ${user.name}'s account and restore access.`
                          : `This will immediately revoke all sessions and block ${user.name} from logging in.`,
                      )
                    }
                    disabled={actionLoading}
                    color={user.isActive === false ? "default" : "success"}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {user.isActive === false ? "Account Deactivated" : "Account Active"}
                  </Typography>
                }
              />

              {hasPaidPlan && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  disabled={actionLoading}
                  onClick={() =>
                    openConfirm(
                      "revoke",
                      "Revoke Subscription?",
                      `This will immediately drop ${user.name} to the free tier. This cannot be undone without a new payment.`,
                    )
                  }
                  startIcon={actionLoading ? <CircularProgress size={14} /> : null}
                  sx={{ borderRadius: `${RADIUS.md}px`, textTransform: "none", fontWeight: 600 }}
                >
                  Revoke Subscription
                </Button>
              )}

              <Button
                variant="outlined"
                size="small"
                disabled={actionLoading}
                onClick={() => setQuotaDialog(true)}
                sx={{ borderRadius: `${RADIUS.md}px`, textTransform: "none", fontWeight: 600 }}
              >
                Reset Quota
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Generic confirm dialog */}
      <Dialog open={confirm.open} onClose={closeConfirm} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{confirm.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirm.body}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeConfirm} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button onClick={handleConfirm} variant="contained" color="error" sx={{ textTransform: "none", fontWeight: 700 }}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quota reset dialog */}
      <Dialog open={quotaDialog} onClose={() => setQuotaDialog(false)} PaperProps={{ sx: { borderRadius: 3, width: 360 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Reset Quota</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Quota Type</InputLabel>
            <Select
              label="Quota Type"
              value={quotaType}
              onChange={(e) => setQuotaType(e.target.value)}
              sx={{ borderRadius: `${RADIUS.md}px` }}
            >
              <MenuItem value="all">All (docs + chats + triage)</MenuItem>
              <MenuItem value="docs">Documents only</MenuItem>
              <MenuItem value="chats">AI Chats only</MenuItem>
              <MenuItem value="triage">Triage only</MenuItem>
            </Select>
          </FormControl>

          {(quotaType === "docs" || quotaType === "all") && (
            <TextField
              size="small"
              label="Docs limit override (optional)"
              type="number"
              placeholder={`Current: ${user?.freeUsage?.docsLimit ?? 3}`}
              value={docsLimitOverride}
              onChange={(e) => setDocsLimit(e.target.value)}
              inputProps={{ min: 0 }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` } }}
            />
          )}
          {(quotaType === "chats" || quotaType === "all") && (
            <TextField
              size="small"
              label="AI chats limit override (optional)"
              type="number"
              placeholder={`Current: ${user?.freeUsage?.aiChatsLimit ?? 5}`}
              value={chatsLimitOverride}
              onChange={(e) => setChatsLimit(e.target.value)}
              inputProps={{ min: 0 }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` } }}
            />
          )}
          <Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>
            Usage counters will be zeroed. Leave limit fields blank to keep current caps.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setQuotaDialog(false)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            onClick={handleResetQuota}
            variant="contained"
            disabled={quotaLoading}
            startIcon={quotaLoading ? <CircularProgress size={14} /> : null}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: `${RADIUS.md}px` }}
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>

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

/* ── Main page ──────────────────────────────────────────────────────────────── */
const BULK_LABELS = {
  deactivate:           "Deactivate selected",
  activate:             "Activate selected",
  "revoke-subscription": "Revoke subscriptions",
};

export default function AdminUsers() {
  const [users, setUsers]               = useState([]);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(0);
  const [rowsPerPage, setRowsPerPage]   = useState(20);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [search, setSearch]             = useState("");
  const [persona, setPersona]           = useState("");
  const [plan, setPlan]                 = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Bulk action state
  const [selectedIds, setSelectedIds]     = useState(new Set());
  const [bulkAction, setBulkAction]       = useState("");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkLoading, setBulkLoading]     = useState(false);
  const [bulkSnack, setBulkSnack]         = useState({ open: false, message: "", severity: "success" });

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page + 1,
      limit: rowsPerPage,
      ...(search  && { search }),
      ...(persona && { persona }),
      ...(plan    && { plan }),
    });
    api
      .get(`/admin/users?${params}`)
      .then(({ data }) => {
        setUsers(data.users || []);
        setTotal(data.pagination?.total || data.total || 0);
      })
      .catch((err) => setError(err.response?.data?.message || "Failed to load users"))
      .finally(() => setLoading(false));
  }, [page, rowsPerPage, search, persona, plan]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Deselect all when the page/filter changes
  useEffect(() => { setSelectedIds(new Set()); }, [page, rowsPerPage, search, persona, plan]);

  // Non-admin user rows (admin accounts are excluded from bulk actions)
  const selectableUsers = users.filter((u) => u.persona?.toLowerCase() !== "admin");
  const allSelected =
    selectableUsers.length > 0 && selectableUsers.every((u) => selectedIds.has(u._id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableUsers.map((u) => u._id)));
    }
  };

  const toggleRow = (id, e) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openBulkDialog = (action) => {
    setBulkAction(action);
    setBulkDialogOpen(true);
  };

  const handleBulkConfirm = async () => {
    setBulkDialogOpen(false);
    setBulkLoading(true);
    try {
      const { data } = await api.post("/admin/users/bulk-action", {
        userIds: Array.from(selectedIds),
        action: bulkAction,
      });
      const msg = `Done — ${data.succeeded?.length ?? 0} succeeded, ${data.failed?.length ?? 0} failed, ${data.skipped?.length ?? 0} skipped.`;
      setBulkSnack({ open: true, message: msg, severity: data.failed?.length ? "warning" : "success" });
      setSelectedIds(new Set());
      fetchUsers();
    } catch (err) {
      setBulkSnack({ open: true, message: err.response?.data?.message || "Bulk action failed.", severity: "error" });
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: "auto" }}>
        <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 3 }}>
          👥 Users
        </GradientHeading>

        {/* Filters */}
        <GlassCard sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              size="small"
              placeholder="Search name, email, phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ flex: "1 1 200px", "& .MuiOutlinedInput-root": { borderRadius: `${RADIUS.md}px` } }}
            />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Persona</InputLabel>
              <Select label="Persona" value={persona} onChange={(e) => { setPersona(e.target.value); setPage(0); }} sx={{ borderRadius: `${RADIUS.md}px` }}>
                <MenuItem value="">All</MenuItem>
                {["citizen", "lawyer", "admin"].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Plan</InputLabel>
              <Select label="Plan" value={plan} onChange={(e) => { setPlan(e.target.value); setPage(0); }} sx={{ borderRadius: `${RADIUS.md}px` }}>
                <MenuItem value="">All</MenuItem>
                {["free", "basic", "pro", "professional", "firm"].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </GlassCard>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        <GlassCard sx={{ overflow: "hidden" }}>
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <Box sx={{
              display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25, flexWrap: "wrap",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-primary-alpha)",
            }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--color-primary)", mr: 0.5 }}>
                {selectedIds.size} selected
              </Typography>
              <Button
                size="small"
                variant="contained"
                color="error"
                disabled={bulkLoading}
                onClick={() => openBulkDialog("deactivate")}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: `${RADIUS.md}px`, height: 30 }}
              >
                Deactivate
              </Button>
              <Button
                size="small"
                variant="contained"
                color="success"
                disabled={bulkLoading}
                onClick={() => openBulkDialog("activate")}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: `${RADIUS.md}px`, height: 30 }}
              >
                Activate
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={bulkLoading}
                onClick={() => openBulkDialog("revoke-subscription")}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: `${RADIUS.md}px`, height: 30 }}
              >
                Revoke Sub
              </Button>
              {bulkLoading && <CircularProgress size={16} />}
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                onClick={() => setSelectedIds(new Set())}
                sx={{ textTransform: "none", color: "var(--color-text-secondary)", height: 30 }}
              >
                Clear
              </Button>
            </Box>
          )}

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
                  <TableCell padding="checkbox">
                    <Tooltip title={allSelected ? "Deselect all" : "Select all non-admin"}>
                      <Checkbox
                        size="small"
                        checked={allSelected}
                        indeterminate={selectedIds.size > 0 && !allSelected}
                        onChange={toggleSelectAll}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Persona</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Joined</TableCell>
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
                  : users.map((u) => {
                      const isAdmin = u.persona?.toLowerCase() === "admin";
                      const isChecked = selectedIds.has(u._id);
                      return (
                        <TableRow
                          key={u._id}
                          hover
                          onClick={() => setSelectedUserId(u._id)}
                          sx={{ cursor: "pointer", "& td": { borderBottom: "1px solid var(--color-border)", py: 1 } }}
                        >
                          <TableCell padding="checkbox" onClick={(e) => !isAdmin && toggleRow(u._id, e)}>
                            {!isAdmin && (
                              <Checkbox size="small" checked={isChecked} onChange={() => {}} />
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--color-text)" }}>
                              {u.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>
                              {u.email}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <UserBadge label={u.persona} colorMap={PERSONA_COLORS} />
                          </TableCell>
                          <TableCell>
                            <UserBadge label={u.plan || "free"} colorMap={PLAN_COLORS} />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={u.isActive === false ? "Inactive" : "Active"}
                              size="small"
                              sx={{
                                height: 20, fontSize: "0.68rem", fontWeight: 700, border: "none",
                                background: u.isActive === false ? "rgba(211,47,47,0.1)" : "rgba(46,125,50,0.1)",
                                color:      u.isActive === false ? "#d32f2f"             : "#2e7d32",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: "var(--color-text-secondary)" }}>
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "—"}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {!loading && users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" sx={{ color: "var(--color-text-secondary)" }}>No users found</Typography>
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

      {/* User detail drawer */}
      <Drawer
        anchor="right"
        open={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        PaperProps={{ sx: { background: "var(--color-surface)" } }}
      >
        <UserDetail
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onRefresh={fetchUsers}
        />
      </Drawer>

      {/* Bulk action confirm dialog */}
      <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{BULK_LABELS[bulkAction]}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will apply <strong>{BULK_LABELS[bulkAction]?.toLowerCase()}</strong> to{" "}
            <strong>{selectedIds.size}</strong> user{selectedIds.size !== 1 ? "s" : ""}. Admin accounts are
            automatically skipped. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBulkDialogOpen(false)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            onClick={handleBulkConfirm}
            variant="contained"
            color="error"
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={bulkSnack.open}
        autoHideDuration={5000}
        onClose={() => setBulkSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={bulkSnack.severity} onClose={() => setBulkSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
          {bulkSnack.message}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
