// ChatNodeSeat in 0.2.1-rc.3 and 0.2.2-rc.1 exposes these same attributes.
const assistant = '[data-chat-flow-kind="assistant-step"]:not([data-chat-group-part="reasoning"])'
const body = ':is(p, h1, h2, h3, h4, h5, h6, ul, ol, pre, blockquote, table):not([data-markdown-variant="compact"] *, [hidden] [hidden], [hidden] [hidden] *)'

export const stylesheet = `
  ${assistant}[data-turn-process-hidden][hidden="until-found"]:has(${body}) {
    content-visibility: visible !important;
    margin-block-start: var(--dsh-chat-flow-gap, 6px);
  }

  ${assistant} h4:not([data-markdown-variant="compact"] *) {
    margin: 18px 0 6px !important;
    padding-left: 10px;
    border-left: 2px solid var(--dsw-alias-brand-primary, currentColor);
    font-size: 13px;
    line-height: 19px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--dsw-alias-label-secondary, inherit);
  }

  ${assistant} h4:first-child:not([data-markdown-variant="compact"] *) {
    margin-top: 2px !important;
  }
`
