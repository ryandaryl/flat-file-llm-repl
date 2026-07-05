import React, { useState, useRef } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import CodeEditor from '@uiw/react-textarea-code-editor';
import md5 from 'blueimp-md5';
import HTMLViewer from './HTMLViewer';

const MinimalEditor = ({ code, onChange, onCtrlEnter }) => {
  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      onCtrlEnter();
    }
  };

  return (
    <div style={{ border: '1px solid #e1e4e8', borderRadius: '6px', overflow: 'hidden' }}>
      <CodeEditor
        value={code}
        language="python"
        placeholder="Please enter code."
        onChange={(ev) => onChange(ev.target.value)}
        onKeyDown={handleKeyDown}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
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

// Single Card Component
const Card = ({ card, isSelected, onSelect, onChange, onRun }) => {
  return (
  <div
    style={{ border: isSelected ? '1px solid #f00' : '1px solid #ccc', padding: '10px', margin: '10px 0', borderRadius: '4px', background: '#fff' }}
    onClick={() => onSelect(card.id)}
  >
    <MinimalEditor code={card.content} onChange={onChange} onCtrlEnter={() => onRun({id: card.id, data: {content: card.content}})}/>
    {card.output && <HTMLViewer rawHtml={card.output} />}
  </div>
)};

// Parent List Component
export function CardList({ cards, onRun, setCards, handleReset }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const setCardContent = (id, content) => {
    setCards(prevCards =>
      prevCards.map(card =>
        card.id === id ? { ...card, content: content } : card
      )
    );
  };

  const handleMove = (ids, direction) => {
    // 1. Convert IDs to a Set for O(1) lookups
    const idSet = new Set(ids);
    if (idSet.size === 0) return;

    // 2. Identify the indices of all selected items
    const selectedIndices = cards
      .map((card, index) => (idSet.has(card.id) ? index : -1))
      .filter(index => index !== -1);

    if (selectedIndices.length === 0) return;

    // 3. Boundary guard: Prevents moving if any edge item hits the boundary
    if (direction === -1 && selectedIndices[0] === 0) return;
    if (direction === 1 && selectedIndices[selectedIndices.length - 1] === cards.length - 1) return;

    // 4. Create a copy and extract unselected items
    const newCards = [...cards];
    const selectedItems = selectedIndices.map(i => newCards[i]);
    const remainingItems = newCards.filter((_, i) => !idSet.has(cards[i].id));

    // 5. Calculate the insertion point for the block of items
    // Moving up (-1) shifts the block left; moving down (1) shifts it right
    const insertIndex = selectedIndices[0] + direction;

    // 6. Reconstruct the array
    remainingItems.splice(insertIndex, 0, ...selectedItems);
    setCards(remainingItems);
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
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            isSelected={selectedIds.includes(card.id)}
            onSelect={(id) => {setSelectedIds((prevIds) => prevIds.includes(id) ? prevIds.filter((itemIds) => itemIds !== id) : [...prevIds, id])}}
            onChange={(content) => setCardContent(card.id, content)}
            onRun={onRun}
          />
        ))}
      </LayoutGroup>
      <button disabled={selectedIds.length === 0} onClick={() => handleMove(selectedIds, -1)} style={{ width: '100%', padding: '10px' }}>▲ Up</button>
      <button disabled={selectedIds.length === 0} onClick={() => handleMove(selectedIds, 1)} style={{ width: '100%', padding: '10px' }}>▼ Down</button>
      <button disabled={selectedIds.length === 0} onClick={() => selectedIds.forEach(handleDelete)} style={{ color: selectedIds.length === 0 ? undefined : 'red', width: '100%', padding: '10px'}}>Delete</button>
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
      <CardList cards={cards} onRun={runJob} setCards={setCards} handleReset={handleReset} />
    </div>
  );
}
