import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from './client';
import { downloadEpisode } from './download.mjs';
import { Button, Notice } from './ui';

export default function DownloadAudio({ episode }) {
  const pending=useRef(false);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false);
  async function save() {
    if(pending.current)return;
    pending.current=true;setBusy(true);setMessage('');setFailed(false);
    try {
      const result=await downloadEpisode(episode,{api,File,Directory,Paths,Sharing,platform:Platform.OS});
      setMessage(result==='saved'?'Áudio salvo na pasta escolhida. Você pode ouvi-lo sem internet.':result==='shared'?'Use a opção Salvar em Arquivos na janela do sistema.':'Download cancelado.');
    }catch(error){setFailed(true);setMessage(error.code?error.message:'Não foi possível salvar o áudio. Confira a conexão e o acesso à pasta e tente novamente.');}
    finally{pending.current=false;setBusy(false);}
  }
  return <View style={{gap:10}}><Button label={busy?'Baixando áudio…':'Baixar áudio'} secondary disabled={busy} onPress={save}/>{message?<Notice error={failed}>{message}</Notice>:null}</View>;
}
