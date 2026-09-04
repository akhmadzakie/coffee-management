import re

with open('src/store/StoreContext.tsx', 'r') as f:
    content = f.read()

# Replace import of detectDevice
content = content.replace("import { detectDevice, DetectedDeviceInfo } from '../utils/deviceDetector';", "import { detectDeviceAsync, DetectedDeviceInfo } from '../utils/deviceDetector';\nimport { get, set, del } from 'idb-keyval';")

# Update StoreProvider variables
provider_start = "export const StoreProvider = ({ children }: { children: ReactNode }) => {"

new_vars = """
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [wasForceLoggedOut, setWasForceLoggedOut] = useState<boolean>(false);
  const deviceRef = useRef<DetectedDeviceInfo>({} as DetectedDeviceInfo);

  useEffect(() => {
    async function loadAuth() {
      try {
        const deviceInfo = await detectDeviceAsync();
        deviceRef.current = deviceInfo;

        let savedUser = await get('node_current_user');
        if (!savedUser) {
          const lsUser = localStorage.getItem('node_current_user');
          if (lsUser) {
             savedUser = JSON.parse(lsUser);
             await set('node_current_user', savedUser).catch(() => {});
          }
        }
        setCurrentUser(savedUser || null);
      } catch (err) {
        console.error("Failed to load auth state", err);
      } finally {
        setIsAuthLoaded(true);
      }
    }
    loadAuth();
  }, []);

  useEffect(() => {
    if (isAuthLoaded) {
      if (currentUser) {
        set('node_current_user', currentUser).catch(console.error);
        localStorage.setItem('node_current_user', JSON.stringify(currentUser));
      } else {
        del('node_current_user').catch(console.error);
        localStorage.removeItem('node_current_user');
      }
    }
  }, [currentUser, isAuthLoaded]);
"""

old_vars_regex = r"  const \[currentUser, setCurrentUser\] = useState<User \| null>\(\(\) => \{[\s\S]*?const deviceRef = useRef<DetectedDeviceInfo>\(detectDevice\(\)\);"
content = re.sub(old_vars_regex, new_vars.strip(), content, count=1)

# Update heartbeat force logout block
heartbeat_logout_old = """          setCurrentUser(null);
          localStorage.removeItem('node_current_user');
          localStorage.removeItem('node_session_id');
          deviceRef.current = detectDevice();
          setWasForceLoggedOut(true);"""

heartbeat_logout_new = """          setCurrentUser(null);
          localStorage.removeItem('node_current_user');
          del('node_current_user').catch(() => {});
          localStorage.removeItem('node_session_id');
          del('node_session_id').catch(() => {});
          detectDeviceAsync().then(info => {
            deviceRef.current = info;
            setWasForceLoggedOut(true);
          });"""

content = content.replace(heartbeat_logout_old, heartbeat_logout_new)

# Update standard logout block
logout_old = """    setCurrentUser(null);
    localStorage.removeItem('node_current_user');
    localStorage.removeItem('node_session_id');
    deviceRef.current = detectDevice();"""

logout_new = """    setCurrentUser(null);
    localStorage.removeItem('node_current_user');
    del('node_current_user').catch(() => {});
    localStorage.removeItem('node_session_id');
    del('node_session_id').catch(() => {});
    detectDeviceAsync().then(info => {
      deviceRef.current = info;
    });"""

content = content.replace(logout_old, logout_new)

# Remove the old localStorage effect for currentUser
content = content.replace("  useEffect(() => { localStorage.setItem('node_current_user', JSON.stringify(currentUser)); }, [currentUser]);\n", "")

# Add loading spinner return
return_statement_idx = content.rfind("return (\n    <StoreContext.Provider")
if return_statement_idx != -1:
    loading_check = """
  if (!isAuthLoaded) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div></div>;
  }

  return (
"""
    content = content[:return_statement_idx] + loading_check.strip() + "\n" + content[return_statement_idx+8:]

with open('src/store/StoreContext.tsx', 'w') as f:
    f.write(content)
