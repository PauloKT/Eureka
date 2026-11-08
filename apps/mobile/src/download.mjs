import { audioExpired } from './api.mjs';

export async function downloadEpisode(episode, { api, File, Directory, Paths, Sharing, platform, now = Date.now }) {
  if(episode.state!=='ready'||audioExpired(episode,now()))throw new Error('O áudio não está disponível para download.');
  let directory;
  if(platform==='android') {
    try { directory=await Directory.pickDirectoryAsync(); }
    catch(error) { if(/cancel|dismiss|reject.*select/i.test(error.message??''))return 'cancelled';throw error; }
  } else if(!await Sharing.isAvailableAsync())throw new Error('Não há opção de salvar arquivos disponível neste aparelho.');
  const stamp=now(), filename=`Eureka-${episode.id.slice(0,8)}-${stamp}.wav`;
  const temporary=new File(Paths.cache,filename);
  let destination, stage='access';
  try {
    const {url}=await api(`/episodes/${episode.id}/audio-access`);
    if(!url?.startsWith('https://'))throw new Error('Não foi possível obter acesso ao áudio.');
    stage='download';
    await File.downloadFileAsync(url,temporary);
    stage='validate';
    if(temporary.size<=44||temporary.size>20_000_000)throw new Error('O arquivo de áudio está incompleto. Tente baixar novamente.');
    const bytes=await temporary.bytes();
    if(String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WAVE')throw new Error('O arquivo recebido não é um áudio WAV válido.');
    if(directory) {
      stage='create';
      destination=directory.createFile(filename,'audio/wav');
      stage='write';
      // SAF overwrite-copy can delete the new document and invalidate its content URI.
      await destination.write(bytes);
      return 'saved';
    }
    stage='share';
    await Sharing.shareAsync(temporary.uri,{mimeType:'audio/wav',UTI:'com.microsoft.waveform-audio',dialogTitle:'Salvar áudio do Eureka'});
    return 'shared';
  } catch(error) {
    try{if(destination?.exists)destination.delete();}catch{}
    if(stage==='access'&&error.code)throw error;
    const messages={access:'Não foi possível obter acesso ao áudio.',download:'Não foi possível baixar o áudio. Confira a conexão e tente novamente.',validate:'O arquivo recebido está incompleto ou não é um WAV válido.',create:'Não foi possível criar o arquivo nesta pasta. Escolha outra pasta.',write:'Não foi possível gravar o áudio na pasta escolhida. Confira o espaço disponível ou escolha outra pasta.',share:'Não foi possível abrir a opção de salvar no aparelho.'};
    const failure=new Error(messages[stage]);failure.code=`DOWNLOAD_${stage.toUpperCase()}`;throw failure;
  } finally { try{if(temporary.exists)temporary.delete();}catch{} }
}
