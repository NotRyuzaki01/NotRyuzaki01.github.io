/** @param {string} sectionId @param {string} itemAttribute */
function enableFilters(sectionId, itemAttribute) {
  const section = document.getElementById(sectionId);
  const controls = section?.querySelector("[data-filters]");
  if (!(controls instanceof HTMLElement)) return;

  const buttons = controls.querySelectorAll("button[data-filter]");
  const items = section?.querySelectorAll(`[${itemAttribute}]`) ?? [];
  const status = document.createElement("span");
  status.className = "visually-hidden";
  status.setAttribute("role", "status");
  controls.after(status);
  controls.hidden = false;

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.getAttribute("data-filter");
      buttons.forEach((candidate) => {
        candidate.setAttribute("aria-pressed", String(button === candidate));
      });

      let count = 0;
      items.forEach((item) => {
        const categories = (item.getAttribute(itemAttribute) ?? "").split(/\s+/);
        const show = filter === "all" || (filter !== null && categories.includes(filter));
        item.toggleAttribute("hidden", !show);
        if (show) count++;
      });
      status.textContent = `${count} ${sectionId} shown.`;
    });
  });
}

function trackSection() {
  const links = Array.from(document.querySelectorAll(".rail nav a[href^='#']"));
  const sections = links.map((link) => document.getElementById(link.getAttribute("href")?.slice(1) ?? ""));
  const header = document.querySelector(".topbar");
  let frame = 0;

  function update() {
    frame = 0;
    const threshold = (header?.getBoundingClientRect().height ?? 0) + 50;
    let active = 0;
    sections.forEach((section, index) => {
      if (section && section.getBoundingClientRect().top <= threshold) active = index;
    });
    if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      active = links.length - 1;
    }
    links.forEach((link, index) => {
      if (index === active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function scheduleUpdate() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("hashchange", scheduleUpdate);
  update();
}

/** @param {HTMLDialogElement} dialog */
function bindCloseButton(dialog) {
  dialog.querySelector("[data-close-dialog]")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) {
      dialog.close();
    }
  });
}

function enableProjectWindows() {
  if (typeof HTMLDialogElement === "undefined") return;
  const dialog = document.getElementById("project-window");
  if (!(dialog instanceof HTMLDialogElement) || typeof dialog.showModal !== "function") return;

  const title = dialog.querySelector("#project-window-title");
  const content = dialog.querySelector("[data-window-content]");
  const expand = dialog.querySelector("[data-expand-window]");
  if (!title || !content || !expand) return;

  bindCloseButton(dialog);
  expand.addEventListener("click", () => {
    const expanded = dialog.toggleAttribute("data-expanded");
    expand.setAttribute("aria-pressed", String(expanded));
    expand.textContent = expanded ? "Restore" : "Expand";
  });
  dialog.addEventListener("close", () => {
    dialog.removeAttribute("data-expanded");
    expand.setAttribute("aria-pressed", "false");
    expand.textContent = "Expand";
  });

  document.querySelectorAll("button[data-project-open]").forEach((trigger) => {
    if (!(trigger instanceof HTMLButtonElement)) return;
    const card = trigger.closest("[data-project]");
    const fallback = card?.querySelector("[data-project-details]");
    const details = fallback?.querySelector("[data-project-content]");
    const heading = card?.querySelector("h3");
    if (!fallback || !details || !heading) return;

    trigger.hidden = false;
    trigger.setAttribute("aria-haspopup", "dialog");
    fallback.setAttribute("hidden", "");
    trigger.addEventListener("click", () => {
      title.textContent = heading.textContent;
      content.replaceChildren(...Array.from(details.childNodes, (node) => node.cloneNode(true)));
      dialog.showModal();
    });
  });
}

function enablePalette() {
  if (typeof HTMLDialogElement === "undefined") return;
  const dialog = document.getElementById("command-palette");
  const trigger = document.querySelector("[data-open-palette]");
  const search = dialog?.querySelector("[data-command-search]");
  const empty = dialog?.querySelector("[data-command-empty]");
  if (!(dialog instanceof HTMLDialogElement) || typeof dialog.showModal !== "function" ||
      !(trigger instanceof HTMLButtonElement) || !(search instanceof HTMLInputElement) ||
      !(empty instanceof HTMLElement)) return;

  const commands = Array.from(dialog.querySelectorAll("a[data-command]"))
    .filter((link) => link instanceof HTMLAnchorElement);
  const shortcut = trigger.querySelector("[data-shortcut]");
  if (shortcut && /Mac|iPhone|iPad/.test(navigator.platform)) shortcut.textContent = "⌘ K";

  const filter = () => {
    const query = search.value.trim().toLowerCase();
    commands.forEach((command) => {
      command.hidden = !(command.textContent ?? "").toLowerCase().includes(query);
    });
    empty.hidden = commands.some((command) => !command.hidden);
  };

  const open = () => {
    if (dialog.open) return;
    const current = document.querySelector("dialog[open]");
    if (current instanceof HTMLDialogElement) current.close();
    search.value = "";
    filter();
    dialog.showModal();
    search.focus();
  };

  trigger.hidden = false;
  trigger.addEventListener("click", open);
  bindCloseButton(dialog);
  search.addEventListener("input", filter);

  commands.forEach((command) => {
    command.addEventListener("click", () => {
      dialog.close();
      const href = command.getAttribute("href") ?? "";
      const target = href.startsWith("#") ? document.getElementById(href.slice(1)) : null;
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    });
  });

  dialog.addEventListener("keydown", (event) => {
    const visible = commands.filter((command) => !command.hidden);
    const index = visible.findIndex((command) => command === document.activeElement);
    if (event.key === "Enter" && event.target === search) {
      event.preventDefault();
      visible[0]?.click();
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = event.key === "ArrowDown" ? visible[index + 1] : visible[index - 1];
      (next ?? search).focus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (dialog.open) dialog.close();
      else open();
    }
  });
}

function enableIdentityLighting() {
  const art = document.querySelector(".identity-console");
  const supported = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  if (!(art instanceof HTMLElement)) return;

  art.addEventListener("pointermove", (event) => {
    if (!supported.matches || event.pointerType !== "mouse") return;
    const bounds = art.getBoundingClientRect();
    art.style.setProperty("--x", `${event.clientX - bounds.left}px`);
    art.style.setProperty("--y", `${event.clientY - bounds.top}px`);
  }, { passive: true });
  art.addEventListener("pointerleave", () => {
    art.style.removeProperty("--x");
    art.style.removeProperty("--y");
  });
}

enableFilters("projects", "data-project");
enableFilters("skills", "data-skill");
trackSection();
enableProjectWindows();
enablePalette();
enableIdentityLighting();
