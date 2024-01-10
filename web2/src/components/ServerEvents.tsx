import { Snackbar } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

export default function ServerEvents() {
  const source = useRef<EventSource | null>(null);
  const [open, setOpen] = useState(false);
  const [eventQueue, setEventQueue] = useState<any[]>([]);

  useEffect(() => {
    const es = new EventSource('http://localhost:8000/api/events');
    source.current = es;

    es.addEventListener('lifecycle', (event) => {
      console.log(event);
    });

    es.addEventListener('xmltv', (event) => {
      setEventQueue((prev) => [...prev, event.data]);
      console.log('xmltv updated', event);
    });

    return () => {
      source.current = null;
      es.close();
    };
  }, [source, setEventQueue]);

  useEffect(() => {
    if (eventQueue.length > 1) {
      setOpen(true);
    }
  }, [eventQueue]);

  const handleClose = () => {
    console.log('handle close');
    if (eventQueue.length === 1) {
      setOpen(false);
      setEventQueue([]);
    } else {
      setEventQueue((prev) => [...prev.slice(1, prev.length)]);
    }
  };

  // const handleClose = () => {

  // };

  return (
    <Snackbar
      autoHideDuration={5000}
      resumeHideDuration={50}
      open={open}
      onClose={handleClose}
      message={
        eventQueue.length > 0 ? JSON.stringify(eventQueue[0]) : 'no events'
      }
    />
  );
}
