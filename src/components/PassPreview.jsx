import {QRCodeSVG} from 'qrcode.react';

export default function PassPreview({data}) {
    if (!data) return null;

    /* colours & text */
    const bg = data.backgroundColor || '#ffffff';
    const fg = data.foregroundColor || '#000000';
    const labelClr = data.labelColor || '#000000';
    const logoText = data.logoText || '';

    /* field shortcuts */
    const header = data.eventTicket?.headerFields?.[0] || {};
    const primary = data.eventTicket?.primaryFields?.[0] || {};
    const secondary1 = data.eventTicket?.secondaryFields?.[0] || {};
    const secondary2 = data.eventTicket?.secondaryFields?.[1] || {};

    /* auxiliary fields – may be seated (Block/Row/Seat) OR standing */
    const aux = data.eventTicket?.auxiliaryFields || [];
    const standingField = aux.find(
        f => (f.label || '').toUpperCase() === 'STANDING' || f.key === 'standing'
    );
    const isStanding = Boolean(standingField);

    /* seated defaults */
    const [aux0 = {}, aux1 = {}, aux2 = {}] = aux;

    /* barcode */
    const barcode = data.barcode || {};

    return (
        <div
            style={{
                width: 320,
                minHeight: 500,
                background: bg,
                color: fg,
                boxShadow: '0 2px 24px #0002',
                padding: 24,
                fontFamily: 'system-ui, sans-serif',
                position: 'sticky',
                top: 32
            }}
        >
            {/* logo + header date */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    height: 30
                }}
            >
                <div style={{fontWeight: 500, fontSize: 14, color: labelClr}}>
                    {logoText}
                </div>
                <div style={{margin: '16px 0 0 0', textAlign: 'right'}}>
                    <div style={{fontSize: 10, color: labelClr}}>{header.label}</div>
                    <div style={{fontWeight: 400, fontSize: 16}}>
                        {typeof header.value === 'string'
                            ? header.value.split('T')[0]
                            : header.value}
                    </div>
                </div>
            </div>

            {/* primary field */}
            <div style={{marginTop: 4}}>
                <div style={{fontSize: 11, color: labelClr}}>{primary.label}</div>
                <div style={{fontWeight: 400, fontSize: 16}}>{primary.value}</div>
            </div>

            {/* secondary fields */}
            <div
                style={{
                    marginTop: 24,
                    display: 'flex',
                    justifyContent: 'space-between'
                }}
            >
                <div>
                    <div style={{fontSize: 12, color: labelClr}}>
                        {secondary1.label}
                    </div>
                    <div style={{fontSize: 14}}>{secondary1.value}</div>
                </div>
                <div style={{textAlign: 'right'}}>
                    <div style={{fontSize: 12, color: labelClr}}>
                        {secondary2.label}
                    </div>
                    <div style={{fontSize: 14}}>{secondary2.value}</div>
                </div>
            </div>

            {/* auxiliary section */}
            {isStanding ? (
                /* ---- STANDING layout ----------------------------------- */
                <div
                    style={{
                        marginTop: 24,
                        textAlign: 'center'
                    }}
                >
                    <div style={{fontSize: 11, color: labelClr}}>STANDING</div>
                    <div style={{fontSize: 16, fontWeight: 500}}>
                        {standingField.value}
                    </div>
                </div>
            ) : (
                /* ---- seated layout (Block / Row / Seat) ---------------- */
                <div
                    style={{
                        marginTop: 24,
                        display: 'flex',
                        justifyContent: 'space-between'
                    }}
                >
                    <div>
                        <div style={{fontSize: 11, color: labelClr}}>Block</div>
                        <div>{aux0.value}</div>
                    </div>
                    <div>
                        <div style={{fontSize: 11, color: labelClr}}>Row</div>
                        <div>{aux1.value}</div>
                    </div>
                    <div>
                        <div style={{fontSize: 11, color: labelClr}}>Seat</div>
                        <div>{aux2.value}</div>
                    </div>
                </div>
            )}

            {/* barcode */}
            <div style={{marginTop: 120, textAlign: 'center'}}>
                <div
                    style={{
                        background: '#fff',
                        color: '#000',
                        padding: 12,
                        borderRadius: 5,
                        display: 'inline-block',
                        minWidth: 140
                    }}
                >
                    {barcode.message && (
                        <QRCodeSVG
                            value={barcode.message}
                            size={100}
                            style={{margin: '0 auto'}}
                        />
                    )}
                    <div style={{fontSize: 10, color: '#000'}}>{barcode.altText}</div>
                </div>
            </div>
        </div>
    );
}
