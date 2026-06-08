import React, { useState, useRef } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import CodeEditor from '@uiw/react-textarea-code-editor';
import md5 from 'blueimp-md5';
import HTMLViewer from './HTMLViewer';

const MinimalEditor = ({ code, onChange }) => {

  return (
    <div style={{ border: '1px solid #e1e4e8', borderRadius: '6px', overflow: 'hidden' }}>
      <CodeEditor
        value={code}
        language="python"
        placeholder="Please enter code."
        onChange={(ev) => onChange(ev.target.value)}
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
const Card = ({ card, index, statuses, isFirst, isLast, onMove, onDelete, onChange, onRun }) => {
  return (
  <motion.div
    layout
    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0', borderRadius: '4px', background: '#fff' }}
  >
    <MinimalEditor code={card.content} onChange={onChange} />
    <StatusDot status={statuses[card.id]} />
    <button onClick={() => onRun({id: card.id, data: {content: card.content}})} style={{ marginLeft: '10px' }}>Run</button>
    <button disabled={isFirst} onClick={() => onMove(index, -1)}>▲ Up</button>
    <button disabled={isLast} onClick={() => onMove(index, 1)}>▼ Down</button>
    <button onClick={() => onDelete(card.id)} style={{ color: 'red', marginLeft: '10px' }}>Delete</button>
    {card.output && <HTMLViewer rawHtml={card.output} />}
  </motion.div>
)};

// Parent List Component
export function CardList({ cards, statuses, onRun, setCards, handleReset }) {
  const setCardContent = (id, content) => {
    setCards(prevCards =>
      prevCards.map(card =>
        card.id === id ? { ...card, content: content } : card
      )
    );
  };

  const handleMove = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= cards.length) return;

    const newCards = [...cards];
    [newCards[index], newCards[nextIndex]] = [newCards[nextIndex], newCards[index]]; // Swap
    setCards(newCards);
  };

  const handleAdd = () => setCards([...cards, { id: Date.now(), content: '' }]);

  const handleDelete = async (id) => {
    // Find the index of the card to delete
    const targetIndex = cards.findIndex(c => c.id === id);
    if (targetIndex === -1) return;

    // Retrieve the target card's content
    const code = cards[targetIndex].content;
    const output = cards[targetIndex].output;

    // Calculate the MD5 hashes
    const code_hash = md5(code);
    const output_hash = md5(output);

    // Construct the query object with the hashes
    const query = {
        "code_hash": code_hash,
        "output_hash": output_hash,
    };

    await fetch(`/api/execution/hide/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(query)
    });

    setCards(cards.filter(c => c.id !== id));
  };


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
            onChange={(content) => setCardContent(card.id, content)}
            onRun={onRun}
          />
        ))}
      </LayoutGroup>
      <button onClick={handleAdd} style={{ width: '100%', padding: '10px' }}>+ Add Card</button>
      <button onClick={handleReset} style={{ width: '100%', padding: '10px' }}>Reset</button>
    </div>
  );
}

export default function App() {
  const [cards, setCards] = useState([{ id: 1, content: ''}]);
  const [status, setStatus] = useState({all: 'never_ran'});
  const intervalRef = useRef(null);

  const handleReset = async () => {
    const query = {
        "content": {"default": true},
        "output": {"default": {"start": null, "end": null}},
    }
    const response = await fetch(`/api/execution/list/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(query)
    });
    const combinedResults = await response.json();
    setCards(combinedResults);
  };

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

      // 2. Poll the status endpoint every 50 milliseconds until it finishes
      intervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/task/status/${jobId}`);
          const responseData = await response.json();
          setStatus({[id]: responseData.status});

          if ((responseData.status === "success") || (responseData.status.includes("error"))) {
            clearInterval(intervalRef.current);
            handleReset();
          }

        } catch (err) {
          setStatus({[id]: "check_error"});
          clearInterval(intervalRef.current);
        }
      }, 50);
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
        start_error: "Error starting job",
        run_error: "Error running job",
      }[Object.values(status)[0]]}</h3>
      <CardList cards={cards} statuses={status} onRun={runJob} setCards={setCards} handleReset={handleReset} />
    </div>
  );
}
