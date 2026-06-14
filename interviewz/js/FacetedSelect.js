/**
 * FacetedSelect Class
 * Reusable ES6 class to control select toggle actions, search inputs, active options filtering,
 * and keyboard navigation (ArrowUp/Down, Enter, Escape).
 */
export class FacetedSelect {
  constructor(container, trigger, searchInput, optionsList, defaultText) {
    this.container = container;
    this.trigger = trigger;
    this.searchInput = searchInput;
    this.optionsList = optionsList;
    this.defaultText = defaultText;
    
    this.focusedIndex = -1;
    this.initEvents();
  }
  
  initEvents() {
    // Toggle active dropdown state on trigger click
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasActive = this.container.classList.contains('active');
      
      // Close other active dropdowns
      document.querySelectorAll('.custom-select').forEach(sel => {
        if (sel !== this.container) {
          sel.classList.remove('active');
          const trigger = sel.querySelector('.select-trigger');
          if (trigger) trigger.setAttribute('aria-expanded', 'false');
        }
      });
      
      this.container.classList.toggle('active');
      const isActive = this.container.classList.contains('active');
      this.trigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      
      if (!wasActive) {
        this.searchInput.value = '';
        this.filterOptions();
        this.searchInput.focus();
        this.resetFocus();
      }
    });
    
    // Filter dropdown elements on user input
    this.searchInput.addEventListener('input', () => {
      this.filterOptions();
      this.resetFocus();
    });
    
    // Handle keyboard accessibility
    this.container.addEventListener('keydown', (e) => {
      if (!this.container.classList.contains('active')) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.moveFocus(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.moveFocus(-1);
          break;
        case 'Enter':
          e.preventDefault();
          this.selectFocused();
          break;
        case 'Escape':
          e.preventDefault();
          this.close();
          this.trigger.focus();
          break;
      }
    });
  }
  
  close() {
    this.container.classList.remove('active');
    this.trigger.setAttribute('aria-expanded', 'false');
    this.resetFocus();
  }
  
  resetFocus() {
    this.focusedIndex = -1;
    this.updateKbdFocusUI();
  }
  
  updateKbdFocusUI() {
    const options = this.getSelectableOptions();
    options.forEach((opt, idx) => {
      if (idx === this.focusedIndex) {
        opt.classList.add('kbd-focused');
        opt.scrollIntoView({ block: 'nearest' });
      } else {
        opt.classList.remove('kbd-focused');
      }
    });
  }
  
  getSelectableOptions() {
    return Array.from(this.optionsList.querySelectorAll('.option')).filter(opt => {
      return opt.style.display !== 'none' && 
             !opt.classList.contains('loading') && 
             !opt.classList.contains('no-match');
    });
  }
  
  moveFocus(dir) {
    const options = this.getSelectableOptions();
    if (options.length === 0) return;
    
    this.focusedIndex += dir;
    if (this.focusedIndex < 0) {
      this.focusedIndex = options.length - 1;
    } else if (this.focusedIndex >= options.length) {
      this.focusedIndex = 0;
    }
    this.updateKbdFocusUI();
  }
  
  selectFocused() {
    const options = this.getSelectableOptions();
    if (this.focusedIndex >= 0 && this.focusedIndex < options.length) {
      options[this.focusedIndex].click();
    }
  }
  
  filterOptions() {
    const filterText = this.searchInput.value.toLowerCase().trim();
    const options = this.optionsList.querySelectorAll('.option');
    let matches = 0;
    
    options.forEach(option => {
      if (option.classList.contains('loading') || option.classList.contains('no-match')) return;
      
      // Always show the "All..." default filter option
      if (option.textContent.startsWith('All ')) {
        option.style.display = '';
        matches++;
        return;
      }
      
      const text = option.textContent.toLowerCase();
      if (text.includes(filterText)) {
        option.style.display = '';
        matches++;
      } else {
        option.style.display = 'none';
      }
    });
    
    // Clear out-of-date "No Matches" labels
    const existingNoMatch = this.optionsList.querySelector('.option.no-match');
    if (existingNoMatch) existingNoMatch.remove();
    
    if (matches === 1) { // Only the default "All..." matched
      const noMatchLi = document.createElement('li');
      noMatchLi.className = 'option no-match';
      noMatchLi.textContent = 'No matching items';
      this.optionsList.appendChild(noMatchLi);
    }
  }
  
  populate(items, selectedValue, onSelectCallback) {
    this.optionsList.innerHTML = '';
    
    // Default option
    const allLi = document.createElement('li');
    allLi.className = `option ${selectedValue === null ? 'selected' : ''}`;
    allLi.setAttribute('role', 'option');
    allLi.setAttribute('aria-selected', selectedValue === null ? 'true' : 'false');
    allLi.textContent = this.defaultText;
    allLi.addEventListener('click', () => {
      this.trigger.querySelector('.trigger-text').textContent = this.defaultText;
      this.close();
      onSelectCallback(null);
    });
    this.optionsList.appendChild(allLi);
    
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = `option ${selectedValue === item ? 'selected' : ''}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', selectedValue === item ? 'true' : 'false');
      li.textContent = item;
      li.addEventListener('click', () => {
        this.trigger.querySelector('.trigger-text').textContent = item;
        this.close();
        onSelectCallback(item);
      });
      this.optionsList.appendChild(li);
    });
    
    this.trigger.querySelector('.trigger-text').textContent = selectedValue || this.defaultText;
    this.filterOptions();
  }
}
