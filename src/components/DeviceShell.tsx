import React, { useState, useEffect } from 'react';

interface DeviceShellProps {
  children: React.ReactNode;
}

export const DeviceShell: React.FC<DeviceShellProps> = ({ children }) => {
  const [time, setTime] = useState<string>('12:00');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setTime(`${hours}:${minutes} ${ampm}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="device-wrapper">
      <div className="device-container">
        {/* Notch / Dynamic Island */}
        <div className="device-notch"></div>

        {/* Status Bar */}
        <div className="device-status-bar">
          <div className="status-bar-left">
            <span className="status-time">{time}</span>
          </div>
          <div className="status-bar-right">
            {/* Cellular Signal Icon */}
            <svg className="status-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <rect x="2" y="16" width="3" height="5" rx="0.5" />
              <rect x="7" y="12" width="3" height="9" rx="0.5" />
              <rect x="12" y="8" width="3" height="13" rx="0.5" />
              <rect x="17" y="3" width="3" height="18" rx="0.5" />
            </svg>
            {/* Wifi Icon */}
            <svg className="status-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 20h.01" />
              <path d="M8.5 16.5a5 5 0 0 1 7 0" />
              <path d="M5 13a10 10 0 0 1 14 0" />
            </svg>
            {/* Battery Icon */}
            <div className="status-battery">
              <div className="battery-level"></div>
            </div>
          </div>
        </div>

        {/* Core Mobile Screen Contents */}
        <div className="device-screen-content">
          {children}
        </div>

        {/* Home Indicator (iOS Swipe Bar) */}
        <div className="device-home-bar"></div>
      </div>
    </div>
  );
};
export default DeviceShell;
