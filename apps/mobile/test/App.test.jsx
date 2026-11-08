import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import App from '../App';
import { api, supabase } from '../src/client';

jest.mock('../src/client',()=>({configError:null,api:jest.fn(),supabase:{auth:{getSession:jest.fn(),onAuthStateChange:jest.fn(()=>({data:{subscription:{unsubscribe:jest.fn()}}})),startAutoRefresh:jest.fn(),stopAutoRefresh:jest.fn(),signInWithPassword:jest.fn(),signUp:jest.fn(),signOut:jest.fn()}}}));
jest.mock('expo-crypto',()=>({randomUUID:()=> '11111111-1111-4111-8111-111111111111'}));
jest.mock('@react-native-async-storage/async-storage',()=>require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/AudioPlayer',()=>()=>null);
jest.mock('react-native-safe-area-context',()=>{
  const {View}=require('react-native');return {SafeAreaProvider:View,SafeAreaView:View};
});
const uid='11111111-1111-4111-8111-111111111111';
const options=count=>Array.from({length:count},(_,i)=>({id:`22222222-2222-4222-8222-22222222222${i}`,themeId:'space',title:`Descoberta ${i+1}`,summary:'Resumo de teste',publishedAt:'2026-11-08',reviewStatus:'preprint',alreadyHeard:false,evidenceReview:'automated',sources:[{id:uid,title:'Fonte de teste',publisher:'arXiv',url:'https://example.org/study',publishedAt:'2026-11-08'}]}));
beforeEach(()=>{
  supabase.auth.getSession.mockResolvedValue({data:{session:{user:{id:uid}}}});
  api.mockImplementation(async path=>{
    if(path==='/me')return {user:{id:uid}};
    if(path==='/capabilities')return {textEnabled:true,speechEnabled:true,followupsEnabled:false};
    if(path==='/discovery-searches')return {selectionSetId:uid,expiresAt:'2026-11-09T00:00:00Z',options:options(1),partial:false,emptyReason:null};
    throw Error('Unexpected route '+path);
  });
});
test('login sends only entered credentials after explicit action',async()=>{
  supabase.auth.getSession.mockResolvedValue({data:{session:null}});
  supabase.auth.signInWithPassword.mockResolvedValue({data:{session:{}},error:null});
  await render(<App/>);
  await screen.findByLabelText('E-mail');
  await fireEvent.changeText(screen.getByLabelText('E-mail'),'tester@example.org');
  await fireEvent.changeText(screen.getByLabelText('Senha'),'test-password');
  expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Entrar'));
  await waitFor(()=>expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({email:'tester@example.org',password:'test-password'}));
});
test.each([0,1,2,3])('renders %i actual options with no automatic episode generation',async count=>{
  const original=api.getMockImplementation();api.mockImplementation((path,args)=>path==='/discovery-searches'?Promise.resolve({selectionSetId:uid,expiresAt:'2026-11-09T00:00:00Z',options:options(count),partial:false,emptyReason:count?null:'no_eligible_evidence'}):original(path,args));
  await render(<App/>);await screen.findByText('Qual descoberta você quer ouvir hoje?');
  await waitFor(()=>expect(screen.queryByText('Recuperando sessão…')).toBeNull());
  await fireEvent.press(screen.getByText('Buscar descobertas'));
  if(count)await screen.findByText('Descoberta 1');else await screen.findByText(/Nenhum estudo com evidências/);
  expect(screen.queryAllByText('Escolher descoberta')).toHaveLength(count);
  expect(api.mock.calls.some(([path])=>path.startsWith('/episodes'))).toBe(false);
  for(const name of ['Espaço','Saúde','Cérebro','Tecnologia','Natureza','Física'])expect(screen.getByText(new RegExp(name))).toBeTruthy();
});
test('surprise is chosen on the server and does not silently start generation',async()=>{
  const original=api.getMockImplementation();api.mockImplementation((path,args)=>path==='/episodes'?Promise.resolve({episode:{id:uid,title:'Resultado da surpresa',state:'selected',sources:[],script:null,audio:null}}):original(path,args));
  await render(<App/>);await waitFor(()=>expect(screen.queryByText('Recuperando sessão…')).toBeNull());
  await fireEvent.press(await screen.findByText('Buscar descobertas'));await screen.findByText('Descoberta 1');
  await fireEvent.press(screen.getByText('Me surpreenda'));await screen.findByText('Resultado da surpresa');
  const call=api.mock.calls.find(([path])=>path==='/episodes');expect(call[1].body).toEqual({selectionSetId:uid,mode:'surprise'});
  expect(api.mock.calls.some(([path])=>path.endsWith('/script'))).toBe(false);
});
