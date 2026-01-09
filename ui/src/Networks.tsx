import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import InfoIcon from "@mui/icons-material/Info";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import FilterListIcon from "@mui/icons-material/FilterList";

import { dockerExec, parseJsonLines, parseDockerError } from "./api";
import type { NetworkInspect, NetworkListRow, NetworkWithDetails } from "./types";

function shortId(id: string) {
  return (id || "").slice(0, 12);
}

async function listNetworks(): Promise<NetworkListRow[]> {
  const r = await dockerExec("network", ["ls", "--format", "{{json .}}"]);
  if (r.stderr) throw new Error(r.stderr);
  return parseJsonLines<NetworkListRow>(r.stdout);
}

async function inspectNetwork(idOrName: string): Promise<NetworkInspect> {
  const r = await dockerExec("network", ["inspect", idOrName]);
  if (r.stderr) throw new Error(r.stderr);
  const arr = JSON.parse(r.stdout || "[]");
  if (!Array.isArray(arr) || !arr[0]) throw new Error("Unexpected inspect output");
  return arr[0] as NetworkInspect;
}

async function createNetwork(payload: {
  name: string;
  driver: string;
  attachable: boolean;
  internal: boolean;
  ipv6: boolean;
  subnet?: string;
  gateway?: string;
}) {
  const args: string[] = ["create"];
  if (payload.driver) args.push("--driver", payload.driver);
  if (payload.attachable) args.push("--attachable");
  if (payload.internal) args.push("--internal");
  if (payload.ipv6) args.push("--ipv6");
  if (payload.subnet) args.push("--subnet", payload.subnet);
  if (payload.gateway) args.push("--gateway", payload.gateway);
  args.push(payload.name);

  const r = await dockerExec("network", args);
  if (r.stderr) throw new Error(r.stderr);
  return (r.stdout || "").trim();
}

async function removeNetwork(idOrName: string) {
  const r = await dockerExec("network", ["rm", idOrName]);
  if (r.stderr) throw new Error(r.stderr);
}

async function pruneNetworks() {
  const r = await dockerExec("network", ["prune", "-f"]);
  if (r.stderr) throw new Error(r.stderr);
  return r.stdout || "";
}

async function connectContainer(network: string, container: string) {
  const r = await dockerExec("network", ["connect", network, container]);
  if (r.stderr) throw new Error(r.stderr);
}

async function disconnectContainer(network: string, container: string, force: boolean) {
  const args = ["disconnect"];
  if (force) args.push("--force");
  args.push(network, container);
  const r = await dockerExec("network", args);
  if (r.stderr) throw new Error(r.stderr);
}

const SYSTEM_NETWORKS = new Set(["bridge", "host", "none"]);

export default function Networks() {
  const [rows, setRows] = React.useState<NetworkListRow[]>([]);
  const [networkDetails, setNetworkDetails] = React.useState<Map<string, NetworkInspect>>(new Map());
  const [q, setQ] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingDetails, setLoadingDetails] = React.useState<Set<string>>(new Set());

  // Filters
  const [filterDriver, setFilterDriver] = React.useState<string>("all");
  const [filterScope, setFilterScope] = React.useState<string>("all");
  const [filterSystemOnly, setFilterSystemOnly] = React.useState<boolean>(false);
  const [showFilters, setShowFilters] = React.useState(false);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [inspected, setInspected] = React.useState<NetworkInspect | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    name: "",
    driver: "bridge",
    attachable: false,
    internal: false,
    ipv6: false,
    subnet: "",
    gateway: "",
  });

  const [connectOpen, setConnectOpen] = React.useState(false);
  const [connectForm, setConnectForm] = React.useState({
    network: "",
    container: "",
  });

  const [disconnectForce, setDisconnectForce] = React.useState(false);

  // Load network details (for container count and flags) on demand
  async function loadNetworkDetails(id: string) {
    if (networkDetails.has(id) || loadingDetails.has(id)) return;
    setLoadingDetails((prev) => new Set(prev).add(id));
    try {
      const details = await inspectNetwork(id);
      setNetworkDetails((prev) => new Map(prev).set(id, details));
    } catch (e: any) {
      // Silently fail - details are optional
      console.warn("Failed to load network details:", e);
    } finally {
      setLoadingDetails((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  // Enhanced filtering
  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      // Text search
      const s = (q || "").toLowerCase();
      const matchesSearch =
        !s ||
        (r.Name || "").toLowerCase().includes(s) ||
        (r.ID || "").toLowerCase().includes(s) ||
        (r.Driver || "").toLowerCase().includes(s) ||
        (r.Scope || "").toLowerCase().includes(s);

      // Driver filter
      const matchesDriver = filterDriver === "all" || r.Driver === filterDriver;

      // Scope filter
      const matchesScope = filterScope === "all" || r.Scope === filterScope;

      // System/user filter
      const isSystem = SYSTEM_NETWORKS.has(r.Name);
      const matchesSystem = filterSystemOnly ? isSystem : true;

      return matchesSearch && matchesDriver && matchesScope && matchesSystem;
    });
  }, [rows, q, filterDriver, filterScope, filterSystemOnly]);

  // Get network with details
  function getNetworkWithDetails(row: NetworkListRow): NetworkWithDetails {
    const details = networkDetails.get(row.ID);
    return {
      ...row,
      Internal: details?.Internal,
      Attachable: details?.Attachable,
      EnableIPv6: details?.EnableIPv6,
      ContainerCount: details?.Containers ? Object.keys(details.Containers).length : undefined,
    };
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listNetworks();
      setRows(data);
      // Clear details cache - will reload on demand
      setNetworkDetails(new Map());
    } catch (e: any) {
      setError(parseDockerError(e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
  }, []);

  // Load details for visible networks
  React.useEffect(() => {
    filtered.slice(0, 20).forEach((row) => {
      if (!networkDetails.has(row.ID) && !loadingDetails.has(row.ID)) {
        loadNetworkDetails(row.ID);
      }
    });
  }, [filtered]);

  async function openInspect(idOrName: string) {
    setError(null);
    try {
      const net = await inspectNetwork(idOrName);
      setInspected(net);
      setDrawerOpen(true);
      // Update cache
      setNetworkDetails((prev) => new Map(prev).set(net.Id, net));
    } catch (e: any) {
      setError(parseDockerError(e));
    }
  }

  async function onRemove(row: NetworkListRow) {
    setError(null);
    try {
      await removeNetwork(row.ID);
      await refresh();
    } catch (e: any) {
      setError(parseDockerError(e));
    }
  }

  async function onPrune() {
    setError(null);
    try {
      await pruneNetworks();
      await refresh();
    } catch (e: any) {
      setError(parseDockerError(e));
    }
  }

  async function onCreate() {
    setError(null);
    try {
      if (!createForm.name.trim()) throw new Error("Network name is required");
      await createNetwork({
        name: createForm.name.trim(),
        driver: createForm.driver,
        attachable: createForm.attachable,
        internal: createForm.internal,
        ipv6: createForm.ipv6,
        subnet: createForm.subnet.trim() || undefined,
        gateway: createForm.gateway.trim() || undefined,
      });
      setCreateOpen(false);
      setCreateForm({
        name: "",
        driver: "bridge",
        attachable: false,
        internal: false,
        ipv6: false,
        subnet: "",
        gateway: "",
      });
      await refresh();
    } catch (e: any) {
      setError(parseDockerError(e));
    }
  }

  async function onConnect() {
    setError(null);
    try {
      if (!connectForm.network.trim()) throw new Error("Network is required");
      if (!connectForm.container.trim()) throw new Error("Container name/ID is required");
      await connectContainer(connectForm.network.trim(), connectForm.container.trim());
      setConnectOpen(false);
      setConnectForm({ network: "", container: "" });
      if (inspected?.Id && inspected.Name === connectForm.network.trim()) {
        const net = await inspectNetwork(inspected.Id);
        setInspected(net);
        setNetworkDetails((prev) => new Map(prev).set(net.Id, net));
      }
      await refresh();
    } catch (e: any) {
      setError(parseDockerError(e));
    }
  }

  async function onDisconnect(network: string, containerIdOrName: string) {
    setError(null);
    try {
      await disconnectContainer(network, containerIdOrName, disconnectForce);
      const net = await inspectNetwork(network);
      setInspected(net);
      setNetworkDetails((prev) => new Map(prev).set(net.Id, net));
      await refresh();
    } catch (e: any) {
      setError(parseDockerError(e));
    }
  }

  // Get unique drivers and scopes for filters
  const drivers = React.useMemo(() => {
    const set = new Set(rows.map((r) => r.Driver).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const scopes = React.useMemo(() => {
    const set = new Set(rows.map((r) => r.Scope).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  return (
    <Box>
      <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
        <TextField
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
          placeholder="Search networks (name, id, driver, scope)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={refresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>

        <IconButton
          onClick={() => setShowFilters(!showFilters)}
          color={showFilters || filterDriver !== "all" || filterScope !== "all" || filterSystemOnly ? "primary" : "default"}
        >
          <FilterListIcon />
        </IconButton>

        <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)}>
          Create
        </Button>

        <Button
          startIcon={<LinkIcon />}
          variant="outlined"
          onClick={() => {
            setConnectOpen(true);
          }}
        >
          Connect
        </Button>

        <Button startIcon={<CleaningServicesIcon />} variant="outlined" onClick={onPrune}>
          Prune
        </Button>
      </Stack>

      {showFilters && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
            <TextField
              size="small"
              label="Driver"
              select
              value={filterDriver}
              onChange={(e) => setFilterDriver(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All drivers</MenuItem>
              {drivers.map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              label="Scope"
              select
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All scopes</MenuItem>
              {scopes.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>

            <FormControlLabel
              control={
                <Switch
                  checked={filterSystemOnly}
                  onChange={(e) => setFilterSystemOnly(e.target.checked)}
                  size="small"
                />
              }
              label="System networks only"
            />
          </Stack>
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ overflow: "hidden" }}>
        <Box sx={{ px: 2, py: 1.5, bgcolor: "background.default", borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle2">
            {loading ? "Loading..." : `${filtered.length} network${filtered.length !== 1 ? "s" : ""}`}
          </Typography>
        </Box>

        {loading && rows.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Stack spacing={1}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={40} />
              ))}
            </Stack>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {rows.length === 0 ? "No networks found" : "No networks match your filters"}
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Driver</TableCell>
                <TableCell>Scope</TableCell>
                <TableCell align="center">IPv6</TableCell>
                <TableCell align="center">Internal</TableCell>
                <TableCell align="center">Attachable</TableCell>
                <TableCell align="center">Containers</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((row) => {
                const details = getNetworkWithDetails(row);
                const isLoadingDetails = loadingDetails.has(row.ID);
                return (
                  <TableRow key={row.ID} hover>
                    <TableCell>
                      <Stack direction="row" gap={1} alignItems="center">
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }} title={row.Name}>
                          {row.Name}
                        </Typography>
                        {SYSTEM_NETWORKS.has(row.Name) && (
                          <Chip size="small" label="system" color="default" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" component="code" sx={{ fontSize: "0.875rem" }}>
                        {shortId(row.ID)}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.Driver}</TableCell>
                    <TableCell>{row.Scope}</TableCell>
                    <TableCell align="center">
                      {isLoadingDetails ? (
                        <Skeleton variant="circular" width={24} height={24} />
                      ) : details.EnableIPv6 ? (
                        <Chip size="small" label="IPv6" color="primary" variant="outlined" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {isLoadingDetails ? (
                        <Skeleton variant="circular" width={24} height={24} />
                      ) : details.Internal ? (
                        <Chip size="small" label="Internal" color="warning" variant="outlined" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {isLoadingDetails ? (
                        <Skeleton variant="circular" width={24} height={24} />
                      ) : details.Attachable ? (
                        <Chip size="small" label="Attachable" color="success" variant="outlined" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {isLoadingDetails ? (
                        <Skeleton variant="text" width={30} />
                      ) : details.ContainerCount !== undefined ? (
                        <Typography variant="body2">{details.ContainerCount}</Typography>
                      ) : (
                        <Tooltip title="Click inspect to load details">
                          <Typography variant="body2" color="text.secondary" sx={{ cursor: "help" }}>
                            ?
                          </Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Inspect">
                        <IconButton size="small" onClick={() => openInspect(row.ID)}>
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={SYSTEM_NETWORKS.has(row.Name) ? "System network (protected)" : "Remove"}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => onRemove(row)}
                            disabled={SYSTEM_NETWORKS.has(row.Name)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Inspect drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 560, p: 2, height: "100%", overflow: "auto" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Network Inspect</Typography>
            {inspected && (
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={async () => {
                  try {
                    const net = await inspectNetwork(inspected.Id);
                    setInspected(net);
                    setNetworkDetails((prev) => new Map(prev).set(net.Id, net));
                  } catch (e: any) {
                    setError(parseDockerError(e));
                  }
                }}
              >
                Refresh
              </Button>
            )}
          </Stack>

          {!inspected ? (
            <Typography variant="body2" color="text.secondary">
              No network selected.
            </Typography>
          ) : (
            <>
              <Stack spacing={0.5} sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <b>Name:</b> {inspected.Name}
                </Typography>
                <Typography variant="body2">
                  <b>Id:</b> <code>{inspected.Id}</code>
                </Typography>
                <Typography variant="body2">
                  <b>Driver:</b> {inspected.Driver}
                </Typography>
                <Typography variant="body2">
                  <b>Scope:</b> {inspected.Scope}
                </Typography>
                <Stack direction="row" gap={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                  {inspected.Internal && <Chip size="small" label="internal" color="warning" />}
                  {inspected.Attachable && <Chip size="small" label="attachable" color="success" />}
                  {inspected.EnableIPv6 && <Chip size="small" label="ipv6" color="primary" />}
                </Stack>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Connected containers ({inspected.Containers ? Object.keys(inspected.Containers).length : 0})
              </Typography>

              <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={disconnectForce}
                      onChange={(e) => setDisconnectForce(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Force disconnect"
                />
              </Stack>

              {inspected.Containers && Object.keys(inspected.Containers).length > 0 ? (
                <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
                  {Object.entries(inspected.Containers).map(([cid, c]) => (
                    <Box
                      key={cid}
                      sx={{
                        px: 1.5,
                        py: 1,
                        "&:not(:last-child)": { borderBottom: "1px solid", borderColor: "divider" },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Tooltip title={`Container ID: ${cid}`}>
                            <Typography variant="body2" noWrap title={c.Name}>
                              <b>{c.Name}</b>
                            </Typography>
                          </Tooltip>
                          <Typography variant="caption" color="text.secondary">
                            <code>{shortId(cid)}</code>
                            {c.IPv4Address ? ` • IPv4 ${c.IPv4Address}` : ""}
                            {c.IPv6Address ? ` • IPv6 ${c.IPv6Address}` : ""}
                            {c.MacAddress ? ` • MAC ${c.MacAddress}` : ""}
                          </Typography>
                        </Box>
                        <Tooltip title="Disconnect container">
                          <IconButton size="small" onClick={() => onDisconnect(inspected.Name, c.Name)}>
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No containers currently attached.
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Raw JSON
              </Typography>
              <Box
                component="pre"
                sx={{
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 1,
                  maxHeight: "40vh",
                  overflow: "auto",
                }}
              >
                {JSON.stringify(inspected, null, 2)}
              </Box>
            </>
          )}
        </Box>
      </Drawer>

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create network</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={createForm.name}
              onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
              required
              autoFocus
              error={!!error && error.includes("already exists")}
              helperText={error && error.includes("already exists") ? error : undefined}
            />
            <TextField
              label="Driver"
              select
              value={createForm.driver}
              onChange={(e) => setCreateForm((s) => ({ ...s, driver: e.target.value }))}
            >
              <MenuItem value="bridge">bridge</MenuItem>
              <MenuItem value="overlay">overlay</MenuItem>
              <MenuItem value="macvlan">macvlan</MenuItem>
              <MenuItem value="ipvlan">ipvlan</MenuItem>
            </TextField>

            <Stack direction="row" gap={1} flexWrap="wrap">
              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.attachable}
                    onChange={(e) => setCreateForm((s) => ({ ...s, attachable: e.target.checked }))}
                  />
                }
                label="Attachable"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.internal}
                    onChange={(e) => setCreateForm((s) => ({ ...s, internal: e.target.checked }))}
                  />
                }
                label="Internal"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.ipv6}
                    onChange={(e) => setCreateForm((s) => ({ ...s, ipv6: e.target.checked }))}
                  />
                }
                label="IPv6"
              />
            </Stack>

            <Divider />
            <Typography variant="subtitle2">Advanced IPAM (optional)</Typography>
            <TextField
              label="Subnet (e.g. 172.28.0.0/16)"
              value={createForm.subnet}
              onChange={(e) => setCreateForm((s) => ({ ...s, subnet: e.target.value }))}
              error={!!error && error.includes("Invalid subnet")}
              helperText={error && error.includes("Invalid subnet") ? error : undefined}
            />
            <TextField
              label="Gateway (e.g. 172.28.0.1)"
              value={createForm.gateway}
              onChange={(e) => setCreateForm((s) => ({ ...s, gateway: e.target.value }))}
            />
            <Typography variant="caption" color="text.secondary">
              For overlay networks, some options require Swarm mode.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={onCreate}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Connect dialog */}
      <Dialog open={connectOpen} onClose={() => setConnectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Connect container to network</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Network (name or ID)"
              value={connectForm.network}
              onChange={(e) => setConnectForm((s) => ({ ...s, network: e.target.value }))}
              placeholder="e.g. my_net"
              autoFocus
            />
            <TextField
              label="Container (name or ID)"
              value={connectForm.container}
              onChange={(e) => setConnectForm((s) => ({ ...s, container: e.target.value }))}
              placeholder="e.g. my-container"
            />
            <Typography variant="caption" color="text.secondary">
              Tip: Use container name (preferred) unless you're scripting.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConnectOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<LinkIcon />} onClick={onConnect}>
            Connect
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
