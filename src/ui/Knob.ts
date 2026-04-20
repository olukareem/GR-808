/**
 * <gr-knob> — SVG rotary knob.
 *
 * Attributes:
 *   label      - display label below the knob
 *   min        - numeric minimum (default 0)
 *   max        - numeric maximum (default 1)
 *   value      - current value (default 0)
 *   default    - value on double-click reset (default = min)
 *   unit       - optional suffix for tooltip ("Hz", "%")
 *   size       - "sm" | "md" | "lg" (default "md")
 *
 * Events:
 *   change  → CustomEvent<{ value: number }>
 */
export class GrKnob extends HTMLElement {
  static observedAttributes = ['value', 'min', 'max', 'label', 'unit', 'size', 'default'];

  private _value = 0;
  private _min = 0;
  private _max = 1;
  private _default = 0;
  private _unit = '';
  private _dragging = false;
  private _dragStartY = 0;
  private _dragStartVal = 0;

  private _svg: SVGElement | null = null;
  private _arc: SVGPathElement | null = null;
  private _indicator: SVGLineElement | null = null;
  private _labelEl: HTMLSpanElement | null = null;
  private _readoutEl: HTMLSpanElement | null = null;

  // Bound handlers kept for cleanup.
  private readonly _onMouseDown: (e: MouseEvent) => void;
  private readonly _onMouseMove: (e: MouseEvent) => void;
  private readonly _onMouseUp: () => void;
  private readonly _onDblClick: () => void;

  constructor() {
    super();
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onDblClick = this._handleDblClick.bind(this);
  }

  connectedCallback(): void {
    // Add base classes without wiping caller-supplied classes (e.g. mixer__vol, mixer__pan).
    this.classList.add('knob', 'knob--' + (this.getAttribute('size') ?? 'md'));
    this._build();
    this.addEventListener('mousedown', this._onMouseDown);
    this.addEventListener('dblclick', this._onDblClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener('mousedown', this._onMouseDown);
    this.removeEventListener('dblclick', this._onDblClick);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
  }

  attributeChangedCallback(name: string, _prev: string, next: string): void {
    if (name === 'value') this._value = parseFloat(next) || 0;
    if (name === 'min') this._min = parseFloat(next) || 0;
    if (name === 'max') this._max = parseFloat(next) || 1;
    if (name === 'default') this._default = parseFloat(next) || this._min;
    if (name === 'unit') this._unit = next;
    if (name === 'label' && this._labelEl) this._labelEl.textContent = next;
    if (this.isConnected) this._render();
  }

  get value(): number { return this._value; }
  set value(v: number) {
    this._value = Math.max(this._min, Math.min(this._max, v));
    if (this.isConnected) this._render();
  }

  private _build(): void {
    this.innerHTML = '';
    const size = this.getAttribute('size') ?? 'md';
    const px = size === 'lg' ? 56 : size === 'sm' ? 32 : 44;
    const r = px / 2 - 4;
    const cx = px / 2;
    const cy = px / 2;

    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._svg.setAttribute('width', String(px));
    this._svg.setAttribute('height', String(px));
    this._svg.setAttribute('viewBox', `0 0 ${px} ${px}`);
    this._svg.classList.add('knob__svg');

    // Track circle.
    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('cx', String(cx));
    track.setAttribute('cy', String(cy));
    track.setAttribute('r', String(r));
    track.classList.add('knob__track');
    this._svg.appendChild(track);

    // Filled arc.
    this._arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this._arc.classList.add('knob__arc');
    this._svg.appendChild(this._arc);

    // Indicator dot.
    this._indicator = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this._indicator.classList.add('knob__indicator');
    this._indicator.setAttribute('x1', String(cx));
    this._indicator.setAttribute('y1', String(cy));
    this._svg.appendChild(this._indicator);

    const label = this.getAttribute('label') ?? '';
    this._unit = this.getAttribute('unit') ?? '';

    const wrap = document.createElement('div');
    wrap.className = 'knob__wrap';

    this._readoutEl = document.createElement('span');
    this._readoutEl.className = 'knob__readout';

    this._labelEl = document.createElement('span');
    this._labelEl.className = 'knob__label';
    this._labelEl.textContent = label;

    wrap.appendChild(this._svg);
    wrap.appendChild(this._readoutEl);
    this.appendChild(wrap);
    this.appendChild(this._labelEl);

    this._value = parseFloat(this.getAttribute('value') ?? '0') || 0;
    this._min = parseFloat(this.getAttribute('min') ?? '0') || 0;
    this._max = parseFloat(this.getAttribute('max') ?? '1') || 1;
    this._default = parseFloat(this.getAttribute('default') ?? String(this._min)) || this._min;

    this._render();
  }

  private _render(): void {
    if (!this._arc || !this._indicator || !this._svg) return;
    const size = this.getAttribute('size') ?? 'md';
    const px = size === 'lg' ? 56 : size === 'sm' ? 32 : 44;
    const r = px / 2 - 4;
    const cx = px / 2;
    const cy = px / 2;

    const t = (this._value - this._min) / (this._max - this._min || 1);
    // Sweep from -225° to +45° (270° total), counterclockwise = lower value.
    const startAngle = -225;
    const endAngle = startAngle + t * 270;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const sx = cx + r * Math.cos(toRad(startAngle));
    const sy = cy + r * Math.sin(toRad(startAngle));
    const ex = cx + r * Math.cos(toRad(endAngle));
    const ey = cy + r * Math.sin(toRad(endAngle));
    const large = t * 270 > 180 ? 1 : 0;

    if (t > 0.001) {
      this._arc.setAttribute('d', `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`);
    } else {
      this._arc.setAttribute('d', '');
    }

    const indAngle = startAngle + t * 270;
    const indLen = r - 3;
    this._indicator.setAttribute('x2', String(cx + indLen * Math.cos(toRad(indAngle))));
    this._indicator.setAttribute('y2', String(cy + indLen * Math.sin(toRad(indAngle))));

    if (this._readoutEl) {
      this._readoutEl.textContent = this._formatVal(this._value);
    }
  }

  private _formatVal(v: number): string {
    const unit = this._unit;
    if (unit === 'Hz') return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
    if (unit === '%') return `${Math.round(v * 100)}%`;
    if (unit === 'ms') return `${Math.round(v * 1000)}`;
    if (unit === 's') return v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`;
    return v % 1 === 0 ? String(Math.round(v)) : v.toFixed(2);
  }

  private _handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    this._dragging = true;
    this._dragStartY = e.clientY;
    this._dragStartVal = this._value;
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
    this.classList.add('knob--active');
  }

  private _handleMouseMove(e: MouseEvent): void {
    if (!this._dragging) return;
    const fine = e.shiftKey;
    const dy = this._dragStartY - e.clientY;
    const range = this._max - this._min;
    const sensitivity = fine ? 0.003 : 0.015;
    const delta = dy * sensitivity * range;
    this.value = this._dragStartVal + delta;
    this._dispatch();
  }

  private _handleMouseUp(): void {
    if (!this._dragging) return;
    this._dragging = false;
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    this.classList.remove('knob--active');
  }

  private _handleDblClick(): void {
    this.value = this._default;
    this._dispatch();
  }

  private _dispatch(): void {
    this.dispatchEvent(new CustomEvent('change', { detail: { value: this._value }, bubbles: true }));
  }
}

customElements.define('gr-knob', GrKnob);
