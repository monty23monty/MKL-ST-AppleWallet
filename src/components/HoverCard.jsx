import {useEffect, useState} from 'react';
import PassPreview from './PassPreview.jsx';

const CARD_W = 250;   // must match UpdatePass math
const CARD_H = 320;
const FADE_MS = 300;

export default function HoverCard({data, top, left, show}) {
    const [rendered, setRendered] = useState(show);

    // keep the node a little longer so fade-out can play
    useEffect(() => {
        if (show) {
            setRendered(true);
        } else {
            const t = setTimeout(() => setRendered(false), FADE_MS);
            return () => clearTimeout(t);
        }
    }, [show]);

    if (!rendered) return null;

    const outerStyle = {
        position: 'fixed',
        top, left,
        width: CARD_W,
        height: CARD_H,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 6px 24px rgba(0,0,0,.25)',
        pointerEvents: 'none',
        zIndex: 10,
        opacity: show ? 1 : 0,
        transform: show ? 'scale(1)' : 'scale(.92)',
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`
    };

    return (
        <div style={outerStyle}>
            {/* shrink the full pass to fit the 260×160 frame */}
            <div style={{transform: 'scale(.8)', transformOrigin: 'top left'}}>
                <PassPreview data={data}/>
            </div>
        </div>
    );
}
