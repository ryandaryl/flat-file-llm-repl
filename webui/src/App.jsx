import React, { useState, useRef, useEffect } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import ReactDiffViewer from 'react-diff-viewer-continued';
import CodeEditor from '@uiw/react-textarea-code-editor';
import md5 from 'blueimp-md5';
import HTMLViewer from './HTMLViewer';

const MinimalEditor = ({ code, onChange, onKeyDown, onButtonClick, buttonVisible, buttonText }) => {
  const editorRef = useRef(null);
  useEffect(() => {
    const textarea = editorRef.current;
    if (!textarea) return;
    textarea.addEventListener('keydown', onKeyDown);
    return () => {
      textarea.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  return (
    <div style={{ position: 'relative', border: '1px solid #e1e4e8', borderRadius: '6px', overflow: 'hidden' }}>
      <CodeEditor
        ref={editorRef}
        value={code}
        language="python"
        placeholder="Please enter code."
        onChange={(ev) => {onChange(ev.target.value)}}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        padding={15}
        style={{
          fontSize: 14,
          backgroundColor: "#f5f5f5", // Light theme. Use #161b22 for dark theme.
          fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
        }}
      />
      {buttonVisible && <button
        onClick={(e) => {e.stopPropagation(); onButtonClick()}}
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          padding: '4px 8px',
          cursor: 'pointer',
          backgroundColor: '#fff',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '11px'
        }}
      >
        {buttonText}
      </button>}
    </div>
  );
};

// Single Card Component
const Card = ({ card, isSelected, onSelect, onChange, onKeyDown }) => {
  const [diffVisible, setDiffVisible] = useState(false)
  return (
  <div
    style={{ border: isSelected ? '1px solid #f00' : '1px solid #ccc', padding: '10px', margin: '10px 0', borderRadius: '4px', background: '#fff' }}
    onClick={() => onSelect(card.id)}
  >
    <MinimalEditor code={card.content} onChange={onChange} onKeyDown={onKeyDown} buttonText={`${diffVisible ? "Hide" : "Show"} Diff`} buttonVisible={Boolean(card.incoming && card.content != card.incoming)} onButtonClick={() => {setDiffVisible((prevDiffVisible) => !prevDiffVisible)}}/>
    {card.incoming && card.content != card.incoming && diffVisible && <ReactDiffViewer
      oldValue={card.base}
      newValue={card.incoming}
      splitView={true}
      codeFoldMessageRenderer={() => <span style={{ display: 'none' }} />}
      hideSummary={true}
    />}
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

  const handleAdd = () => setCards([...cards, { id: Date.now(), content: '', source: 'ui' }]);

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

  const handleKeyDown = ({id, uiKey, source, event}) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onRun({id, data: {content: event.target.value, source}, uiKey});
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '20px auto' }}>
      <LayoutGroup>
        {cards.map((card, index) => (
          <Card
            key={index}
            card={card}
            isSelected={selectedIds.includes(card.id)}
            onSelect={(id) => {setSelectedIds((prevIds) => prevIds.includes(id) ? prevIds.filter((itemIds) => itemIds !== id) : [...prevIds, id])}}
            onChange={(content) => {setCardContent(card.id, content)}}
            onKeyDown={(event) => {handleKeyDown({id: card.id, uiKey: index, source: card.source, event})}}
            onRun={onRun}
            uiKey={index}
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
  const [cards, setCards] = useState([{ id: 1, content: '', source: 'ui'}]);
  const [status, setStatus] = useState({all: 'never_ran'});
  const [memoryLimit, setMemoryLimit] = useState(24);
  const [cellIndices, setCellIndices] = useState(null);

  useEffect(() => {
    handleReset(); 
  }, []);

  useEffect(() => {
    const handleUnload = () => {
      navigator.sendBeacon('/api/uistate/new/', new Blob([JSON.stringify(cards.map(({ content }) => content))], { type: 'application/json' }));
    }
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [cards]);

  const handleReset = async ({addUiState = [], nextCellIndices = null} = {}) => {
    const response1 = await fetch(`/api/uistate/${0}`);
    var response1Json= await response1.json();
    var uiState = response1Json["incoming"];
    uiState = uiState.concat(addUiState);

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
    var combinedResults = await response.json();
    combinedResults = combinedResults.map((result) => ({...result, source: 'db'}));
    nextCellIndices = nextCellIndices || Array.from({ length: combinedResults.length }, (_, i) => [i]);
    setCellIndices(nextCellIndices);
    combinedResults = nextCellIndices.map(subArray => {
        const lastIndex = subArray[subArray.length - 1];
        return combinedResults[lastIndex];
    });
    if (uiState.length === combinedResults.length) {
      combinedResults = combinedResults.map((result, index) => {
        const base = response1Json["base"][index];
        const incoming = uiState[index];
        return {
          ...result,
          base: base === incoming ? null : base,
          incoming: base === incoming ? null : incoming
        };
      });
    }
    setCards(combinedResults);
  };

  const runJob = async ({id, data, uiKey}) => {
    setStatus({[id]: "sent"});
    try {
      // 1. Trigger the process. This is a blocking request.
      await fetch(`/api/task/run/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: data.content,
          memoryLimit: Number(memoryLimit)
        })
      });
      setStatus({[id]: "success"});
      fetch('/api/uistate/new/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cards.map(({ content }) => content)),
      });
      const nextCellIndices = structuredClone(cellIndices);
      const newExecutionNumber = Math.max(...cellIndices.flat(), -1) + 1;
      if (data.source === 'db') {
        nextCellIndices[uiKey].push(newExecutionNumber);
      } else {
        nextCellIndices.push([newExecutionNumber]);
      }
      handleReset({addUiState: data.source === 'db' ? [data.content] : [], nextCellIndices});
    } catch (err) {
      setStatus({[id]: "run_error"});
      throw err;
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '50px' }}>
      <h3 style={{ marginTop: '20px', color: '#333' }}>{{
        never_ran: "Press Ctrl-Enter to start",
        sent: "Waiting for the task to complete...",
        success: "Status: Task Completed Successfully!",
        run_error: "Error running job",
      }[Object.values(status)[0]]}</h3>
      <div style={{ marginBottom: '20px' }}>
        Tasks allocating more than{' '}
        <input
          type="number"
          value={memoryLimit}
          onChange={(e) => setMemoryLimit(e.target.value)}
          style={{ width: '50px', textAlign: 'center', padding: '2px', margin: '0 5px' }}
          min="1"
        />{' '}
        GB of RAM will be stopped gracefully.
      </div>
      <CardList cards={cards} onRun={runJob} setCards={setCards} handleReset={handleReset} />
    </div>
  );
}
