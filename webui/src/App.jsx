import React, { useState, useRef } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import CodeEditor from '@uiw/react-textarea-code-editor';

const MinimalEditor = ({ initialCode, onChange }) => {
  const [code, setCode] = useState(initialCode || '');

  return (
    <div style={{ border: '1px solid #e1e4e8', borderRadius: '6px', overflow: 'hidden' }}>
      <CodeEditor
        value={code}
        language="python"
        placeholder="Please enter code."
        onChange={(ev) => {
          setCode(ev.target.value);
          if (onChange) onChange(ev.target.value);
        }}
        padding={15}
        style={{
          fontSize: 14,
          backgroundColor: "#f5f5f5", // Light theme. Use #161b22 for dark theme.
          fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
        }}
      />
    </div>
  );
};

export function LoadingDot() {
  const dotStyle = {
    position: 'relative',
    width: '6px',
    height: '6px',
    top: '50%',
    backgroundColor: '#3498db',
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite ease-in-out',
  };

  return (
    <div style={{ placeItems: 'center', height: '15px' }}>
      <style>{`
      @keyframes pulse {
        0%, 100% { transform: scale(0.5); opacity: 0.3; }
        50% { transform: scale(1.5); opacity: 1; }
      }
    `}</style>
      <div style={dotStyle} />
    </div>
  );
}

const StatusDot = ({status}) => (
  <div style={{ display: 'inline-block', placeItems: 'center', height: '15px', margin: '0px 2px 0px 2px' }}>
  {status === 'running' && <LoadingDot />}
  {status !== 'running' && <div style={{ width: '6px' }} />}
  </div>
)

// Single Card Component
const Card = ({ card, index, statuses, isFirst, isLast, onMove, onDelete, onRun }) => {
  const [code, setCode] = useState('');
  return (
  <motion.div
    layout
    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0', borderRadius: '4px', background: '#fff' }}
  >
    <MinimalEditor onChange={setCode} />
    <StatusDot status={statuses[card.id]} />
    <button onClick={() => onRun({id: card.id, data: {content: code}})} style={{ marginLeft: '10px' }}>Run</button>
    <button disabled={isFirst} onClick={() => onMove(index, -1)}>▲ Up</button>
    <button disabled={isLast} onClick={() => onMove(index, 1)}>▼ Down</button>
    <button onClick={() => onDelete(card.id)} style={{ color: 'red', marginLeft: '10px' }}>Delete</button>
  </motion.div>
)};

// Parent List Component
export function CardList({ statuses, onRun }) {
  const [cards, setCards] = useState([{ id: 1, title: 'Card 1' }]);

  const handleMove = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= cards.length) return;

    const newCards = [...cards];
    [newCards[index], newCards[nextIndex]] = [newCards[nextIndex], newCards[index]]; // Swap
    setCards(newCards);
  };

  const handleAdd = () => setCards([...cards, { id: Date.now(), title: `Card ${cards.length + 1}` }]);
  const handleDelete = (id) => setCards(cards.filter(c => c.id !== id));

  return (
    <div style={{ maxWidth: '1000px', margin: '20px auto' }}>
      <LayoutGroup>
        {cards.map((card, index) => (
          <Card
            key={card.id}
            card={card}
            index={index}
            statuses={statuses}
            isFirst={index === 0}
            isLast={index === cards.length - 1}
            onMove={handleMove}
            onDelete={handleDelete}
            onRun={onRun}
          />
        ))}
      </LayoutGroup>
      <button onClick={handleAdd} style={{ width: '100%', padding: '10px' }}>+ Add Card</button>
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState({all: 'never_ran'});
  const intervalRef = useRef(null);

  const runJob = async ({id, data}) => {
    // Clear any existing intervals if clicked repeatedly
    if (intervalRef.current) clearInterval(intervalRef.current);

    const jobId = "job_" + Math.random().toString(36).substring(7);
    setStatus({[id]: "starting"});

    try {
      // 1. Trigger the background process
      await fetch(`/api/task/start/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      // 2. Poll the status endpoint every 1 second until it finishes
      intervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/task/status/${jobId}`);
          const responseData = await response.json();
          setStatus({[id]: responseData.status});

          if (responseData.status === "success") {
            clearInterval(intervalRef.current);
          }
        } catch (err) {
          setStatus({[id]: "check_error"});
          clearInterval(intervalRef.current);
        }
      }, 1000);
    } catch (err) {
      setStatus({[id]: "start_error"});
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '50px' }}>
      <h3 style={{ marginTop: '20px', color: '#333' }}>{{
        never_ran: "Click the button to start",
        starting: "Starting...",
        waiting: "Waiting...",
        running: "Status: Running",
        success: "Status: Task Completed Successfully!",
        check_error: "Error checking status",
        start_error: "Error starting job"
      }[Object.values(status)[0]]}</h3>
      <CardList statuses={status} onRun={runJob}/>
    </div>
  );
}
