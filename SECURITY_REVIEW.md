# Security & Code Review Report

## 🔴 Critical Security Issues

### 1. **Command Injection Vulnerability**
**Location:** `ui/src/Networks.tsx` - All functions that accept user input

**Issue:** User-provided inputs (network names, container names, subnet, gateway) are passed directly to Docker CLI commands without sanitization or validation. While the Docker Extension API may provide some protection, this is still a dangerous pattern.

**Affected Functions:**
- `createNetwork()` - `payload.name`, `payload.subnet`, `payload.gateway`
- `removeNetwork()` - `idOrName`
- `inspectNetwork()` - `idOrName`
- `connectContainer()` - `network`, `container`
- `disconnectContainer()` - `network`, `containerIdOrName`

**Risk:** An attacker could potentially inject malicious commands if they can control these inputs.

**Recommendation:**
- Validate all inputs against Docker's naming conventions
- Sanitize inputs to prevent injection
- Use allowlists for network names (alphanumeric, hyphens, underscores only)
- Validate IP addresses for subnet/gateway using proper regex or IP validation library

### 2. **Unsafe JSON Parsing**
**Location:** 
- `ui/src/api.ts:20` - `parseJsonLines()`
- `ui/src/Networks.tsx:45` - `inspectNetwork()`

**Issue:** `JSON.parse()` is called without try-catch blocks. If Docker CLI returns malformed JSON, the application will crash.

**Example:**
```typescript
// ui/src/api.ts:20
.map((l) => JSON.parse(l) as T);  // Can throw SyntaxError

// ui/src/Networks.tsx:45
const arr = JSON.parse(r.stdout || "[]");  // Can throw SyntaxError
```

**Risk:** Application crashes, poor error handling, potential information disclosure through error messages.

**Recommendation:** Wrap all `JSON.parse()` calls in try-catch blocks and provide meaningful error messages.

---

## 🟠 High Priority Issues

### 3. **Missing Input Validation**
**Location:** `ui/src/Networks.tsx` - Form handlers

**Issues:**
- Network names: No validation for Docker naming rules (alphanumeric, hyphens, underscores, max length)
- Subnet/Gateway: No IP address format validation
- Container names/IDs: No format validation

**Recommendation:**
- Add validation functions for network names (regex: `^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`)
- Validate IP addresses and CIDR notation for subnet
- Validate IP addresses for gateway

### 4. **Missing Confirmation Dialogs**
**Location:** `ui/src/Networks.tsx` - Destructive actions

**Issue:** No confirmation dialogs for:
- `onRemove()` - Network removal
- `onPrune()` - Pruning all unused networks
- `onDisconnect()` - Container disconnection

**Risk:** Accidental data loss, user frustration.

**Recommendation:** Add confirmation dialogs for all destructive operations.

### 5. **Logic Bug in Network Comparison**
**Location:** `ui/src/Networks.tsx:222`

**Issue:** 
```typescript
if (inspected?.Id && inspected.Name === connectForm.network.trim()) {
```
This comparison fails if the user enters a network ID instead of name, even though the function accepts both.

**Recommendation:** Compare by both ID and name, or normalize the comparison.

### 6. **Missing Error Code Handling**
**Location:** `ui/src/api.ts:7-12`

**Issue:** The `dockerExec` function doesn't check the exit code (`code` field) from Docker CLI. It only checks `stderr`, but Docker may return errors via exit codes without stderr.

**Recommendation:** Check both `code !== 0` and `stderr` for errors.

---

## 🟡 Medium Priority Issues

### 7. **Type Safety Issues**
**Location:** Multiple files

**Issues:**
- Using `any` type in error handlers: `catch (e: any)`
- Using `any` in parseJsonLines: `parseJsonLines<T = any>`
- Missing type guards for API responses

**Recommendation:**
- Use `unknown` instead of `any` for error handling
- Add proper type guards
- Validate API response shapes

### 8. **Missing Loading States**
**Location:** `ui/src/Networks.tsx`

**Issue:** Only global `loading` state exists. Individual operations (remove, connect, disconnect) don't show loading indicators, making the UI feel unresponsive.

**Recommendation:** Add per-operation loading states.

### 9. **Race Condition Potential**
**Location:** `ui/src/Networks.tsx:214-229` - `onConnect()`

**Issue:** Multiple async operations without proper sequencing:
```typescript
await connectContainer(...);
setConnectOpen(false);
setConnectForm({ network: "", container: "" });
if (inspected?.Id && inspected.Name === connectForm.network.trim()) {
  const net = await inspectNetwork(inspected.Id);
  setInspected(net);
}
await refresh();
```

If `connectForm.network` changes between operations, the comparison may be incorrect.

**Recommendation:** Store the network identifier in a local variable before async operations.

### 10. **Missing Documentation**
**Location:** All source files

**Issue:** No JSDoc comments for functions, especially API functions.

**Recommendation:** Add JSDoc documentation for all exported functions and complex logic.

---

## 🟢 Low Priority / Code Quality Issues

### 11. **Dockerfile Optimization**
**Location:** `Dockerfile:5`

**Issue:** 
```dockerfile
RUN cd ui && (npm ci || npm install)
```
This fallback to `npm install` defeats the purpose of `npm ci` (deterministic builds). If `package-lock.json` is missing, the build should fail.

**Recommendation:** Use `npm ci` only, or fail explicitly if lock file is missing.

### 12. **Missing Error Boundaries**
**Location:** `ui/src/App.tsx`

**Issue:** No React Error Boundary to catch and display errors gracefully.

**Recommendation:** Add an Error Boundary component.

### 13. **Hardcoded System Networks**
**Location:** `ui/src/Networks.tsx:97`

**Issue:** System networks are hardcoded. If Docker adds new system networks, they won't be protected.

**Recommendation:** Consider detecting system networks dynamically or making the list configurable.

### 14. **Missing Network Name Validation in UI**
**Location:** `ui/src/Networks.tsx:470-476`

**Issue:** The network name TextField doesn't validate input in real-time or show format requirements.

**Recommendation:** Add input validation with helper text showing allowed characters.

### 15. **Inefficient Re-renders**
**Location:** `ui/src/Networks.tsx:127-135`

**Issue:** The `filtered` array is recalculated on every render, even when `q` or `rows` haven't changed.

**Recommendation:** Use `useMemo` for the filtered array.

---

## Summary

**Critical:** 2 issues (Command injection, Unsafe JSON parsing)
**High:** 4 issues (Input validation, Missing confirmations, Logic bugs, Error handling)
**Medium:** 4 issues (Type safety, Loading states, Race conditions, Documentation)
**Low:** 5 issues (Code quality improvements)

**Total:** 15 issues identified

---

## Recommended Fix Priority

1. **Immediate:** Fix JSON parsing error handling (#2)
2. **Immediate:** Add input validation (#3)
3. **High:** Add confirmation dialogs (#4)
4. **High:** Fix error code handling (#6)
5. **Medium:** Improve type safety (#7)
6. **Medium:** Add loading states (#8)
7. **Low:** Code quality improvements (#11-15)
