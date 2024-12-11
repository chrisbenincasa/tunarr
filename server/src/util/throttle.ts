//Adds a slight pause so that long operations
export default function (): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
