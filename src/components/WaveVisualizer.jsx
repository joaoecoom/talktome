import React from 'react';
import './WaveVisualizer.css';

export function WaveVisualizer({ isActive }) {
    const bars = Array.from({ length: 12 }, (_, i) => i);
    return (
        <div className={`wave-visualizer ${isActive ? 'active' : ''}`} aria-hidden="true">
            {bars.map((i) => (
                <div
                    key={i}
                    className="wave-bar"
                    style={{ animationDelay: `${i * 0.08}s` }}
                />
            ))}
        </div>
    );
}
