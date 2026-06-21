const fs = require('fs');
const path = require('path');

function walkSync(dir, callback) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            walkSync(filepath, callback);
        } else if (filepath.endsWith('.md')) {
            callback(filepath);
        }
    }
}

let totalFixed = 0;
walkSync(__dirname, (filepath) => {
    let content = fs.readFileSync(filepath, 'utf-8');
    let modified = false;

    let inMermaid = false;
    let diagramType = '';
    
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.trim().startsWith('```mermaid')) {
            inMermaid = true;
            diagramType = '';
            continue;
        }
        if (inMermaid && line.trim() === '```') {
            inMermaid = false;
            continue;
        }
        
        if (inMermaid) {
            if (!diagramType && line.trim().length > 0) {
                diagramType = line.trim().split(' ')[0];
            }
            
            if (diagramType === 'sequenceDiagram') {
                // Fix `participant A as B` -> `participant A as "B"`
                const matchParticipant = line.match(/^(\s*participant\s+[A-Za-z0-9_]+\s+as\s+)([^"].*?)$/);
                if (matchParticipant) {
                    lines[i] = `${matchParticipant[1]}"${matchParticipant[2]}"`;
                    modified = true;
                }
                
                // Fix `actor A as B` -> `actor A as "B"`
                const matchActor = line.match(/^(\s*actor\s+[A-Za-z0-9_]+\s+as\s+)([^"].*?)$/);
                if (matchActor) {
                    lines[i] = `${matchActor[1]}"${matchActor[2]}"`;
                    modified = true;
                }
            }
            
            // Fix flowchart/graph unquoted nodes with ( or ) or [[ or ]]
            // e.g. A[Label (with parens)] -> A["Label (with parens)"]
            if (diagramType.startsWith('graph') || diagramType.startsWith('flowchart')) {
                // match Node[Label] where Label doesn't start with " but contains ( ) [ ]
                const nodeMatch = line.match(/^(\s*[A-Za-z0-9_]+\s*\[)([^"]*?[()[\]].*?)(\])/);
                if (nodeMatch) {
                    // lines[i] = line.replace(nodeMatch[0], `${nodeMatch[1]}"${nodeMatch[2]}"${nodeMatch[3]}`);
                    // modified = true;
                }
            }
        }
    }

    if (modified) {
        console.log('Fixed participants in:', filepath);
        fs.writeFileSync(filepath, lines.join('\n'), 'utf-8');
        totalFixed++;
    }
});
console.log('Total files fixed:', totalFixed);
