/**
 * Panel OBJETO: catálogo completo con el objeto activo y sus cargas.
 * Las cargas a 0 se marcan como vacías pero siguen visibles.
 */
export const itemsPanel = {
  label: 'OBJETO',

  render(menu) {
    const activeId = menu.getActiveItemId();

    Object.entries(menu.itemCatalog).forEach(([id, definition]) => {
      const count = menu.player.items[id] ?? 0;
      const row = menu.makeRow(definition.name, {
        value: `×${count}`,
        active: id === activeId,
        empty: count <= 0
      });
      menu.addRow(
        row,
        () => selectItem(menu, id, definition),
        () => previewItem(menu, id, definition, count)
      );
    });

    const active = menu.itemCatalog[activeId];
    menu.panelDetail.textContent = `Activo: ${active.name}. ${active.description}`;
  }
};

/** Vista previa con estado activo y aviso de existencias. */
function previewItem(menu, id, definition, count) {
  const suffix = count <= 0 ? ' Sin existencias.' : '';
  const active = id === menu.getActiveItemId() ? ' ACTIVO.' : '';
  menu.panelDetail.textContent = `${definition.name}: ${definition.description}${active}${suffix}`;
}

/** Marca el objeto que usará el comando OBJETO en el combate. */
function selectItem(menu, itemId, definition) {
  menu.onSelectItem(itemId, definition);
  menu.refreshPanel(
    `Activo: ${definition.name}. ${definition.description}`,
    Object.keys(menu.itemCatalog).indexOf(itemId)
  );
}
