import { Outlet } from 'react-router-dom';

export default function SettingsLayout() {
  return (
    <div>
      <h1>Settingspage</h1>
      <Outlet />
    </div>
  );
}
