import React, { useState } from 'react';
import { Button, Popover, PopoverHeader, PopoverBody, Label } from 'reactstrap';

const ColorPickerPopover = ({
  id = 'color-popover-btn',
  buttonLabel = 'Customize Colors',
  baseColors,
  setBaseColors,
  resetColors,
  className,
  small = true,
}) => {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((s) => !s);

  if (!baseColors || !setBaseColors) return null;

  return (
    <>
      <Button
        id={id}
        color="outline-secondary"
        size={small ? 'sm' : 'md'}
        className={className}
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        title="Customize point & legend colors"
      >
        <i className="fas fa-paint-roller me-2" style={{ fontSize: 14 }} />
        {buttonLabel}
      </Button>

      <Popover placement="bottom" target={id} isOpen={open} toggle={toggle}>
        <PopoverHeader className="small text-muted">Colors</PopoverHeader>
        <PopoverBody className="p-2" style={{ minWidth: 260 }}>
          <div className="d-flex align-items-center mb-2">
            <div style={{ minWidth: 88 }}>
              <Label className="mb-1 fw-bold small">Negative (0)</Label>
              <div className="d-flex align-items-center">
                <input
                  aria-label="Negative color"
                  type="color"
                  value={baseColors.negative}
                  onChange={(e) => setBaseColors((c) => ({ ...c, negative: e.target.value }))}
                  style={{ width: 36, height: 30, border: 'none', padding: 0 }}
                />
                <code className="ms-2 small" style={{ fontSize: 12 }}>{baseColors.negative}</code>
              </div>
            </div>

            <div style={{ minWidth: 88 }} className="ms-3">
              <Label className="mb-1 fw-bold small">Positive (1)</Label>
              <div className="d-flex align-items-center">
                <input
                  aria-label="Positive color"
                  type="color"
                  value={baseColors.positive}
                  onChange={(e) => setBaseColors((c) => ({ ...c, positive: e.target.value }))}
                  style={{ width: 36, height: 30, border: 'none', padding: 0 }}
                />
                <code className="ms-2 small" style={{ fontSize: 12 }}>{baseColors.positive}</code>
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="small text-muted">Preview</div>
            <div className="d-flex align-items-center">
              <div style={{ width: 16, height: 16, background: baseColors.negative, borderRadius: 4, border: '1px solid rgba(0,0,0,0.06)' }} />
              <div style={{ width: 16, height: 16, background: baseColors.positive, borderRadius: 4, border: '1px solid rgba(0,0,0,0.06)', marginLeft: 8 }} />
            </div>
          </div>

          <div className="d-flex gap-2 mt-1">
            <Button color="secondary" size="sm" onClick={() => { resetColors && resetColors(); }} className="flex-grow-1">Reset</Button>
            <Button color="primary" size="sm" onClick={toggle} className="flex-grow-1">Done</Button>
          </div>
        </PopoverBody>
      </Popover>
    </>
  );
};

export default ColorPickerPopover;
