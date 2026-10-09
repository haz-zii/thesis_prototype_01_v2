export function createTextLog(element) {
  let value = '';

  function render() {
    element.textContent = value;
    element.scrollTop = element.scrollHeight;
  }

  return {
    insert(char) {
      value += char;
      render();
    },
    newline() {
      value += '\n';
      render();
    },
    backspace() {
      value = Array.from(value).slice(0, -1).join('');
      render();
    },
    clear() {
      value = '';
      render();
    },
    value() {
      return value;
    },
  };
}
