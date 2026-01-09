# Docker Networks UI Extension - MVP Proposal

## Current State Assessment

The extension currently implements:
- ✅ Network list with search (name, ID, driver, scope)
- ✅ Inspect drawer with network details and raw JSON
- ✅ Create network dialog (with driver, attachable, internal, IPv6, subnet, gateway)
- ✅ Remove network (with system network protection)
- ✅ Connect/disconnect containers to networks
- ✅ Prune unused networks
- ✅ Connected containers display in inspect drawer
- ✅ Direct CLI calls from UI (Pattern A - no backend service)

**Architecture**: Uses Pattern A (direct CLI calls via `ddClient.docker.cli.exec`) - simpler and appropriate for MVP.

## MVP Scope - What's Missing

### 1. Enhanced Network Table Columns
**Current**: Name, ID (short), Driver, Scope, Actions  
**Should add for MVP**:
- **IPv6** (boolean indicator chip)
- **Internal** (boolean indicator chip)
- **Attachable** (boolean indicator chip)
- **# Containers** (count from inspect data)

**Rationale**: These are core network properties users need to see at a glance. The "Created" timestamp is less critical for MVP and can be deferred.

### 2. Better Container Name Display
**Current**: Shows container name from `network.Containers` map  
**Issue**: Container names in inspect may be prefixed with network name or not fully qualified  
**MVP fix**: 
- Use container name as-is (it's usually correct)
- Add tooltip showing full container ID
- Consider fetching container list to show friendly names (nice-to-have, not critical)

### 3. Improved Error Handling
**Current**: Generic error messages  
**Should add**:
- Specific error message when removing network with attached containers
- Suggest "disconnect containers first" action
- Better validation for create network form (duplicate name, invalid subnet format)

### 4. Basic Filtering
**Current**: Search only (text matching)  
**Should add for MVP**:
- Filter by driver (bridge, overlay, etc.) - dropdown or chips
- Filter by scope (local, swarm, global) - dropdown or chips
- Filter by system vs user-created networks - toggle

**Rationale**: Essential for managing many networks. More advanced filters (compose labels, etc.) can wait.

### 5. UI Polish
**Current**: Functional but could be more "Containers-like"  
**Should improve**:
- Use proper MUI Table component instead of custom grid (better accessibility, sorting potential)
- Add loading states (skeleton loaders)
- Better empty states ("No networks found", "No containers attached")
- Status chips styling (system, internal, attachable, IPv6)

## Out of Scope for MVP

These can be added later:
- ❌ Backend service (Pattern A is fine for MVP)
- ❌ Bulk actions (multi-select + batch remove)
- ❌ Event stream watching (docker events)
- ❌ Compose project label display (nice-to-have)
- ❌ Created timestamp column (less critical)
- ❌ Advanced IPAM configuration UI (current form is sufficient)
- ❌ Network statistics/monitoring
- ❌ Export/import network configs

## Implementation Plan

### Phase 1: Table Enhancements
1. Add IPv6, Internal, Attachable columns (boolean chips)
2. Add container count column (requires inspect call per network - may need caching or batch)
3. Convert custom grid to MUI Table component

### Phase 2: Filtering
1. Add filter bar with:
   - Driver dropdown (bridge, overlay, macvlan, ipvlan, host, none)
   - Scope dropdown (local, swarm, global)
   - System/user toggle
2. Combine with existing search functionality

### Phase 3: Error Handling & UX
1. Parse Docker CLI errors for common cases:
   - "network has active endpoints" → suggest disconnect
   - "network name already exists" → clear validation message
   - Invalid subnet format → form validation
2. Add loading skeletons
3. Improve empty states

### Phase 4: Container Display
1. Verify container name display (may already be fine)
2. Add container ID tooltip
3. Consider fetching container list for friendly names (if needed)

## Technical Notes

### Container Count Performance
Getting container count requires `docker network inspect` for each network. Options:
- **Option A**: Lazy load on hover/expand (fast initial load)
- **Option B**: Batch inspect all networks (slower but complete)
- **Option C**: Cache inspect results and refresh on demand

**Recommendation for MVP**: Option A - show count only in inspect drawer initially, add to table later if performance is acceptable.

### Filtering Implementation
- Use React state to track active filters
- Combine with existing search text filter
- Apply all filters to `filtered` array before rendering

### Error Parsing
Docker CLI errors are in stderr. Common patterns:
- `"network <name> has active endpoints"` → container attached
- `"network with name <name> already exists"` → duplicate name
- `"invalid CIDR address"` → subnet format error

Parse these and show user-friendly messages.

## Success Criteria

MVP is complete when:
1. ✅ Table shows all essential network properties (IPv6, Internal, Attachable, container count)
2. ✅ Users can filter networks by driver, scope, and system/user
3. ✅ Error messages are clear and actionable
4. ✅ UI feels polished and "Containers-like"
5. ✅ All core operations work reliably (list, create, remove, connect, disconnect, prune, inspect)

## File Changes Summary

**Files to modify**:
- `ui/src/Networks.tsx` - Main component (table, filters, error handling)
- `ui/src/types.ts` - Add types for filters if needed
- `ui/src/api.ts` - Add error parsing helpers (optional)

**No new files needed** - keep it simple.
