// Optional local QA only. No connection URL, Production credential or host input.
// Install the documented pinned test dependency outside the repository.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function createDatabase(){
 if(!process.env.EMBEDDED_POSTGRES_MODULE) throw new Error('Set EMBEDDED_POSTGRES_MODULE to the locally installed embedded-postgres module');
 const {default:EmbeddedPostgres}=await import(process.env.EMBEDDED_POSTGRES_MODULE);
 const directory=await mkdtemp(join(tmpdir(),'e012-disposable-'));
 const server=new EmbeddedPostgres({databaseDir:join(directory,'data'),port:55439,user:'postgres',password:'local-disposable-fixture',
  persistent:false,createPostgresUser:false,initdbFlags:['--locale=C','--encoding=UTF8'],postgresFlags:['-h','127.0.0.1','-k',directory],onLog:()=>{},onError:()=>{}});
 const clients=[];
 try{
  await server.initialise();await server.start();
  for(let i=0;i<3;i++){
   const client=server.getPgClient('postgres','127.0.0.1');
   client.setTypeParser(20,value=>Number(value)); // Fixture IDs/counts are deliberately tiny.
   await client.connect();await client.query("set statement_timeout='10s';set lock_timeout='8s'");clients.push(client);
  }
 }catch(error){await Promise.all(clients.map(c=>c.end()));await server.stop().catch(()=>{});throw error;}
 return {exec:sql=>clients[0].query(sql),query:(sql,params)=>clients[0].query(sql,params),clients:clients.slice(1),
  close:async()=>{await Promise.all(clients.map(c=>c.end()));await server.stop();}};
}
