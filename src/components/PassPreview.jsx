import {QRCodeSVG} from "qrcode.react";

function PassPreview({data}) {
    if (!data) return null;

    // Defensive defaults in case of missing/empty fields
    const bg = data.backgroundColor || "#ffffff";
    const fg = data.foregroundColor || "#000000";
    const label = data.labelColor || "#000000";
    const logoText = data.logoText || "";

    // Shortcuts for ticket fields
    const header = data.eventTicket?.headerFields?.[0] || {};
    const primary = data.eventTicket?.primaryFields?.[0] || {};
    const secondary1 = data.eventTicket?.secondaryFields?.[0] || {};
    const secondary2 = data.eventTicket?.secondaryFields?.[1] || {};
    const aux0 = data.eventTicket?.auxiliaryFields?.[0] || {};
    const aux1 = data.eventTicket?.auxiliaryFields?.[1] || {};
    const aux2 = data.eventTicket?.auxiliaryFields?.[2] || {};
    const barcode = data.barcode || {};

    return (
        <div style={{
            width: 320,
            minHeight: 500,
            background: bg,
            color: fg,
            boxShadow: '0 2px 24px #0002',
            paddingBottom: 24,
            paddingLeft: 24,
            paddingRight: 24,
            fontFamily: 'system-ui, sans-serif',
            position: 'sticky',
            top: 32,
        }}>
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '30px'
            }}>
                <div style={{fontWeight: 500, fontSize: 14, color: label, top: 30}}>{logoText}</div>
                <div style={{margin: '16px 0 0 0', textAlign: 'right'}}>
                    <div style={{fontSize: 10, color: label}}>{header.label}</div>
                    <div style={{fontWeight: 400, fontSize: 16}}>
                        {header.value && typeof header.value === 'string'
                            ? header.value.split('T')[0]
                            : header.value}
                    </div>

                </div>
            </div>
            <div style={{margin: '4px 0 0 0', paddingTop: 4}}>
                <div style={{fontSize: 11, color: label}}>{primary.label}</div>
                <div style={{fontWeight: 400, fontSize: 16}}>
                    {primary.value}
                </div>
            </div>
            <div style={{margin: '24px 0 0 0', display: 'flex', justifyContent: 'space-between'}}>
                <div>
                    <div style={{fontSize: 12, color: label}}>{secondary1.label}</div>
                    <div style={{fontSize: 14}}>{secondary1.value}</div>
                </div>
                <div style={{textAlign: 'right'}}>
                    <div style={{fontSize: 12, color: label}}>{secondary2.label}</div>
                    <div style={{fontSize: 14}}>{secondary2.value}</div>
                </div>
            </div>
            <div style={{margin: '24px 0 0 0', display: 'flex', justifyContent: 'space-between'}}>
                <div>
                    <div style={{fontSize: 11, color: label}}>Block</div>
                    <div>{aux0.value}</div>
                </div>
                <div>
                    <div style={{fontSize: 11, color: label}}>Row</div>
                    <div>{aux1.value}</div>
                </div>
                <div>
                    <div style={{fontSize: 11, color: label}}>Seat</div>
                    <div>{aux2.value}</div>
                </div>
            </div>
            <div style={{margin: '120px 0 0 0', textAlign: 'center'}}>
                <div style={{
                    background: '#fff',
                    color: '#000',
                    padding: 12,
                    borderRadius: 5,
                    display: 'inline-block',
                    fontSize: 10,
                    marginBottom: 4,
                    minWidth: 140,
                }}>
                    {/* Barcode display as text placeholder */}
                    {barcode.message && (
                        <QRCodeSVG value={barcode.message} size={100} style={{margin: '0 auto'}}/>
                    )}
                    <div style={{fontSize: 10, color: '#000'}}>
                        {barcode.altText}
                    </div>
                </div>

            </div>
        </div>
    );
}

export default PassPreview;
