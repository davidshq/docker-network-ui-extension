import React from "react";
import { AppBar, Box, Container, Toolbar, Typography, Alert } from "@mui/material";
import Networks from "./Networks";
import { getDockerClient } from "./api";

export default function App() {
  const [ddClientAvailable, setDdClientAvailable] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(true);

  React.useEffect(() => {
    // Check if Docker Desktop client is available
    // Give it a small delay to ensure Docker Desktop has injected the client
    const checkClient = async () => {
      // Small delay to allow Docker Desktop to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const client = getDockerClient();
      if (client) {
        setDdClientAvailable(true);
        // Test with a simple command that doesn't require format parsing
        try {
          await client.docker.cli.exec("info", []);
          console.log("Docker Desktop client is working");
        } catch (err: any) {
          console.error("Docker Desktop client test failed:", err);
        }
      }
      setIsChecking(false);
    };
    
    checkClient();
  }, []);

  // Show banner if running in browser/dev mode
  if (!ddClientAvailable && !isChecking) {
    return (
      <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", p: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="h6">Development Mode</Typography>
          <Typography variant="body2">
            Docker Desktop client is not available. This extension must be run inside Docker Desktop.
          </Typography>
          <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
            The UI will work normally when loaded in Docker Desktop.
          </Typography>
        </Alert>
        <Box sx={{ flex: 1, overflow: "auto" }}>
          <Container maxWidth="xl" sx={{ py: 2 }}>
            <Networks />
          </Container>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Networks
          </Typography>
          {isChecking && (
            <Typography variant="caption" color="text.secondary">
              Initializing...
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: "auto" }}>
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Networks />
        </Container>
      </Box>
    </Box>
  );
}
