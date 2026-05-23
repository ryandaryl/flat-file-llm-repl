import React, { useState, useRef } from 'react';
import { motion, LayoutGroup } from 'framer-motion';

// Single Card Component
const Card = ({ card, index, isFirst, isLast, onMove, onDelete }) => (
  // Change <div> to <motion.div> and add the layout prop
  <motion.div
    layout
    transition={{ type: 'spring', stiffness: 300, damping: 30 }} // Optional: makes the swap snappy
    style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0', borderRadius: '4px', background: '#fff' }}
  >
    <h4>{card.title}</h4>
    <button disabled={isFirst} onClick={() => onMove(index, -1)}>▲ Up</button>
    <button disabled={isLast} onClick={() => onMove(index, 1)}>▼ Down</button>
    <button onClick={() => onDelete(card.id)} style={{ color: 'red', marginLeft: '10px' }}>Delete</button>
  </motion.div>
);

// Parent List Component
export function CardList() {
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
    <div style={{ maxWidth: '400px', margin: '20px auto' }}>
      <button onClick={handleAdd} style={{ width: '100%', padding: '10px' }}>+ Add Card</button>
      <LayoutGroup>
        {cards.map((card, index) => (
          <Card
            key={card.id}
            card={card}
            index={index}
            isFirst={index === 0}
            isLast={index === cards.length - 1}
            onMove={handleMove}
            onDelete={handleDelete}
          />
        ))}
      </LayoutGroup>
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState('Click the button to start');
  const intervalRef = useRef(null);

  const runJob = async () => {
    // Clear any existing intervals if clicked repeatedly
    if (intervalRef.current) clearInterval(intervalRef.current);

    const jobId = "job_" + Math.random().toString(36).substring(7);
    setStatus("Starting...");

    try {
      // 1. Trigger the background process
      await fetch(`/api/task/start/${jobId}`, { method: 'POST' });

      // 2. Poll the status endpoint every 1 second until it finishes
      intervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/task/status/${jobId}`);
          const data = await res.json();
          setStatus(`Status: ${data.status}`);

          if (data.status.includes("Successfully")) {
            clearInterval(intervalRef.current);
          }
        } catch (err) {
          setStatus("Error checking status");
          clearInterval(intervalRef.current);
        }
      }, 1000);
    } catch (err) {
      setStatus("Error starting job");
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '50px' }}>
      <button 
        onClick={runJob} 
        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
      >
        Run Background Process
      </button>
      <h3 style={{ marginTop: '20px', color: '#333' }}>{status}</h3>
      <CardList />
    </div>
  );
}
