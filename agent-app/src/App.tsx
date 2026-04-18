import React from 'react';
// Must be imported before AgentDesktop so window.connect is populated
import 'amazon-connect-streams';
import { AgentDesktop } from './components/AgentDesktop';

export default function App() {
  return <AgentDesktop />;
}
