import { Low, Memory } from 'lowdb';

type Data = {
  obj: {
    x: number;
    y: string;
  };
};

test('LowDB referential uppdates', async () => {
  const db = new Low<Data>(new Memory(), { obj: { x: 1, y: 'string' } });
  await db.read();
  const data = db.data;
  console.log(data);
  data.obj.x = 100;
  await db.write();
  console.log(db.data);
});
