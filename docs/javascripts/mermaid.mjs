import mermaid from './vendor/mermaid.esm.min.mjs';
import elkLayouts from './vendor/mermaid-layout-elk.esm.min.mjs';

mermaid.registerLayoutLoaders(elkLayouts);
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  layout: "elk",
});

// Important: necessary to make it visible to Zensical
window.mermaid = mermaid;
