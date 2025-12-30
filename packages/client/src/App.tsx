import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useChatStore } from './stores/chatStore';
import { Auth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';

function App() {
  const { user, token, checkAuth } = useAuthStore();
  const { connect, disconnect, isConnected } = useChatStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (token && user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [token, user, connect, disconnect]);

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="app">
      <Sidebar />
      <ChatArea />
      {!isConnected && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: 'var(--warning)',
            color: 'black',
            padding: '8px',
            textAlign: 'center',
            fontSize: '13px',
            fontWeight: 500,
            zIndex: 1000,
          }}
        >
          Connecting to server...
        </div>
      )}
    </div>
  );
}

export default App;
