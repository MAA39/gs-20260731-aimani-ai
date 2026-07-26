import { createFileRoute } from '@tanstack/react-router';
import { CheckSquare } from 'lucide-react';
export const Route = createFileRoute('/todos')({ component: TodosRoute });
function TodosRoute(){ return <section className="content"><div className="intro"><p className="eyebrow">SHARED WORK</p><h2>Todos</h2><p>関係する人と進めている仕事を確認します。</p></div><div className="placeholder-surface"><CheckSquare size={24} aria-hidden="true"/><h3>共有 Todo はここに集まります</h3><p>People のワークスペースから、次の action を追加できます。</p></div></section> }
