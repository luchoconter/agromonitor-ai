
import React from 'react';
import { MapPin, BellRing, Trash2, CheckCircle2, Circle, Calendar, Play, Pause, Edit, User } from 'lucide-react';
import { LotSummary, AppState, User as UserType } from '../../types';

interface SummaryListProps {
  summaries: LotSummary[];
  isListView: boolean;
  currentUser: UserType | null;
  data: AppState;
  playingAudioId: string | null;
  onCardClick: (summary: LotSummary) => void;
  onToggleAudio: (url: string, id: string, e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onReview: (e: React.MouseEvent, summary: LotSummary) => void;
  onFeedback: (e: React.MouseEvent, summary: LotSummary) => void;
}

export const SummaryList: React.FC<SummaryListProps> = ({
  summaries,
  isListView,
  currentUser,
  data,
  playingAudioId,
  onCardClick,
  onToggleAudio,
  onDelete,
  onReview,
  onFeedback
}) => {

  const formatDate = (iso: string) => { const d = new Date(iso); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };

  const getStatusBorderClass = (status: string) => {
    switch (status) {
        case 'rojo': return 'border-l-red-500 dark:border-l-red-400';
        case 'amarillo': return 'border-l-yellow-500 dark:border-l-yellow-400';
        case 'verde': return 'border-l-green-500 dark:border-l-green-400';
        default: return 'border-l-gray-300 dark:border-l-gray-600';
    }
  };

  const statusBadgeColors: Record<string, string> = { 
      verde: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800', 
      amarillo: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800', 
      rojo: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' 
  };

  if (isListView) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-semibold uppercase text-xs">
                    <tr>
                        <th className="px-4 py-3 w-3"></th>
                        <th className="px-4 py-3">Lote / Campo</th>
                        <th className="px-4 py-3">Fecha / Usuario</th>
                        <th className="px-4 py-3 w-1/3">Notas</th>
                        <th className="px-4 py-3 text-center">Audios</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {summaries.map(s => {
                            const status = s.engineerStatus || s.status;
                            return (
                            <tr key={s.id} onClick={() => onCardClick(s)} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors">
                                <td className={`px-0 py-0 ${status==='rojo'?'bg-red-500':status==='amarillo'?'bg-yellow-500':'bg-green-500'}`}></td>
                                <td className="px-4 py-3">
                                    <div className="font-semibold text-gray-900 dark:text-white text-sm">{data.plots.find(p=>p.id===s.plotId)?.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{data.fields.find(f=>f.id===s.fieldId)?.name}</div>
                                </td>
                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">
                                    <div>{formatDate(s.date)}</div>
                                    <div className="text-xs flex items-center mt-1"><User className="w-3 h-3 mr-1" /> {s.userName || 'Usuario'}</div>
                                </td>
                                <td className="px-4 py-3 text-sm italic text-gray-600 dark:text-gray-300">{s.notes}</td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex justify-center gap-2">
                                        {s.audioUrl && <span className="text-gray-400 dark:text-gray-500" title="Audio Operario"><Play className="w-4 h-4"/></span>}
                                        {s.engineerAudioUrl && <span className="text-blue-500 dark:text-blue-400" title="Feedback"><Play className="w-4 h-4"/></span>}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right flex items-center justify-end gap-6">
                                    {currentUser?.role === 'admin' && (
                                        <>
                                            <button 
                                                onClick={(e) => onDelete(e, s.id)} 
                                                className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" 
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                                            <button onClick={(e)=>onReview(e,s)} className="text-gray-400 hover:text-green-500 dark:text-gray-500 dark:hover:text-green-400">
                                                {s.isReviewed ? <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400"/> : <Circle className="w-5 h-5"/>}
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                            );
                    })}
                </tbody>
            </table>
        </div>
    );
  }

  // GRID VIEW
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaries.map(summary => {
            const plotName = data.plots.find(p => p.id === summary.plotId)?.name;
            const fieldName = data.fields.find(f => f.id === summary.fieldId)?.name;
            const displayStatus = summary.engineerStatus || summary.status;
            const isCritical = !summary.isReviewed && displayStatus === 'rojo';
            
            const borderClass = getStatusBorderClass(displayStatus);
            
            return (
                <div 
                    key={summary.id} 
                    onClick={() => onCardClick(summary)} 
                    className={`
                        rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col relative group
                        border-l-4 border-gray-200 dark:border-gray-700 ${borderClass}
                        ${summary.isReviewed ? 'bg-gray-50 dark:bg-gray-800/60' : 'bg-white dark:bg-gray-800'}
                        ${!summary.isReviewed && displayStatus === 'rojo' ? 'shadow-red-100 dark:shadow-red-900/10' : ''}
                    `}
                >
                    <div className="p-4 flex-1">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className={`font-bold text-lg ${summary.isReviewed ? 'text-gray-600 dark:text-gray-400' : 'text-gray-800 dark:text-white'}`}>{plotName}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                        <MapPin className="w-3 h-3 mr-1 inline" /> {fieldName}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isCritical && <div className="animate-bounce text-red-500 bg-red-50 dark:bg-red-900/30 p-1 rounded-full"><BellRing className="w-4 h-4 fill-current" /></div>}
                                {currentUser?.role === 'admin' && (
                                    <>
                                        <button 
                                            onClick={(e) => onDelete(e, summary.id)} 
                                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/50 mr-1" 
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => onReview(e, summary)} className={`p-1.5 rounded-full ${summary.isReviewed ? 'text-green-500 dark:text-green-400' : 'text-gray-300 dark:text-gray-600'}`}>
                                            {summary.isReviewed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-between mb-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border flex items-center ${statusBadgeColors[displayStatus]}`}>
                                <Circle className="w-2 h-2 mr-1.5 fill-current" />{displayStatus}
                            </span>
                            <div className="flex flex-col items-end">
                                <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center font-mono">
                                    <Calendar className="w-3 h-3 mr-1" />{formatDate(summary.date)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1">
                                    <User className="w-3 h-3 mr-1" /> {summary.userName || 'Usuario'}
                                </div>
                            </div>
                        </div>
                        {summary.notes && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 p-2.5 rounded-lg italic border border-gray-100 dark:border-gray-700/50 mb-2">
                                "{summary.notes}"
                            </p>
                        )}
                        {summary.engineerNotes && (
                            <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800 mt-2">
                                <b>ING:</b> "{summary.engineerNotes}"
                            </div>
                        )}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700 flex divide-x divide-gray-200 dark:divide-gray-700">
                        {summary.audioUrl ? (
                            <button onClick={(e) => onToggleAudio(summary.audioUrl!, summary.id, e)} className="flex-1 p-2 flex items-center justify-center space-x-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-agro-600 dark:hover:text-agro-400">
                                {playingAudioId === summary.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                <span>Audio Op.</span>
                                <audio id={`audio-${summary.id}`} src={summary.audioUrl} className="hidden" />
                            </button>
                        ) : <div className="flex-1 p-2 text-xs text-center text-gray-300 dark:text-gray-600">Sin Audio</div>}
                        
                        {summary.engineerAudioUrl && (
                            <button onClick={(e) => onToggleAudio(summary.engineerAudioUrl!, `eng-${summary.id}`, e)} className="flex-1 p-2 flex items-center justify-center space-x-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                {playingAudioId === `eng-${summary.id}` ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                <span>Feedback</span>
                                <audio id={`audio-eng-${summary.id}`} src={summary.engineerAudioUrl} className="hidden" />
                            </button>
                        )}
                        
                        {currentUser?.role === 'admin' && (
                            <button onClick={(e) => onFeedback(e, summary)} className="flex-1 p-2 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Editar Feedback">
                                <Edit className="w-4 h-4 mr-1.5" /> <span className="text-xs">Editar</span>
                            </button>
                        )}
                    </div>
                </div>
            );
        })}
    </div>
  );
};
