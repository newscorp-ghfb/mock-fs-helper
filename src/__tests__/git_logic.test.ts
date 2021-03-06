///<reference types="jest"/>
import * as mockfs from 'mock-fs'
// import * as fs from 'fs'
// import * as path from 'path'
import _ from 'lodash';
import { AbsPath } from "../index"
import { GitLogic } from '../git_logic';
import * as tmp from 'tmp';

tmp.setGracefulCleanup()

let tmpdir_obj: tmp.SynchrounousResult
let tmpdir: AbsPath
let projdir: AbsPath


beforeEach(async () => {
    tmpdir_obj = tmp.dirSync({ unsafeCleanup: true })
    tmpdir = new AbsPath(tmpdir_obj.name)
    console.log("*** Creating temp dir:", tmpdir.realpath)
    init_simple_repo()
})

afterEach(async () => {
    tmpdir_obj.removeCallback()
})


function init_simple_repo() {
    projdir = tmpdir.add('proj')
    const gitbase = projdir.add('.git')
    gitbase.add('objects').add('info').mkdirs()
    gitbase.add('objects').add('pack').mkdirs()
    gitbase.add('refs').add('heads').mkdirs()
    gitbase.add('refs').add('tags').mkdirs()
    gitbase.add('HEAD').saveStrSync('ref: refs/heads/master')

    tmpdir.add('non_proj').mkdirs()
}


describe('git logic', () => {
    test('repo detection', () => {
        init_simple_repo()
        let gl = new GitLogic(tmpdir.add('proj'));
        expect(gl.is_repo).toBeTruthy()

        let gl2 = new GitLogic(new AbsPath('/non_proj'));
        expect(gl2.is_repo).toBeFalsy()
    })

    test('check ignore', () => {
        let gl = new GitLogic(tmpdir.add('proj'));
        expect(gl.is_repo).toBeTruthy()

        projdir.add('.gitignore').saveStrSync('ignored')
        projdir.add('regularfile').saveStrSync('this file is not ignored')
        projdir.add('ignored').saveStrSync('this file is ignored')
        projdir.add('subdir').mkdirs()
        projdir.add('subdir').add('regfile2').saveStrSync('this file should not be ignored')
        projdir.add('subdir').add('ignored').saveStrSync('this file should be ignored')

        expect(gl.check_ignore(projdir.add('ignored')._abspath)).toBeTruthy()
        expect(gl.check_ignore(projdir.add('subdir/ignored')._abspath)).toBeTruthy()
        expect(gl.check_ignore(projdir.add('regularfile')._abspath)).toBeFalsy()
        expect(gl.check_ignore(projdir.add('subdir/regfile2')._abspath)).toBeFalsy()

        const ignored = gl.get_all_ignored_files()
        expect(ignored).toContain(projdir.add('ignored')._abspath)
        expect(ignored).toContain(projdir.add('subdir/ignored')._abspath)
        expect(ignored.length).toEqual(2)

        gl.analyze_repo_contents(true)
        expect(gl.fast_is_file_in_repo(projdir.add('regularfile').abspath)).toBeTruthy()
        expect(gl.fast_is_file_in_repo(projdir.add('ignored').abspath)).toBeFalsy()
    })

    test('ls files', () => {
        let gl = new GitLogic(tmpdir.add('proj'));
        expect(gl.is_repo).toBeTruthy()

        const p = projdir.add('regularfile')
        p.saveStrSync('this file is not ignored')

        gl.add(p._abspath)
        gl.commit('added a file')

        const files = gl.ls_files()
        expect(files).toEqual(['regularfile'])

        const paths = gl.ls_files_as_abspath()
        expect(paths).toEqual([p])

    })

    test('remote', () => {
        let gl = new GitLogic(tmpdir.add('proj'), { silent: true });
        expect(gl.is_repo).toBeTruthy()

        let remotes = gl.get_remotes()
        expect(remotes.length).toEqual(0)

        gl.add_remote("remote1", "url1")
        remotes = gl.get_remotes()
        expect(remotes.length).toEqual(1)
        expect(remotes[0].name).toEqual("remote1")
        expect(remotes[0].url).toEqual("url1")

        gl.add_remote("remote2", "url2")
        remotes = gl.get_remotes()
        expect(remotes.length).toEqual(2)
        expect(remotes[0].name).toEqual("remote1")
        expect(remotes[0].url).toEqual("url1")
        expect(remotes[1].name).toEqual("remote2")
        expect(remotes[1].url).toEqual("url2")

        gl.remove_remote("remote2")
        remotes = gl.get_remotes()
        expect(remotes.length).toEqual(1)
        expect(remotes[0].name).toEqual("remote1")

        gl.rename_remote('remote1', 'remote0')
        remotes = gl.get_remotes()
        expect(remotes.length).toEqual(1)
        expect(remotes[0].name).toEqual("remote0")
    })

    test('clone', () => {
        const cloned_path = tmpdir.add('proj2')
        let gl = new GitLogic(cloned_path)
        expect(gl.is_repo).toBeFalsy()
        expect(cloned_path.add('.git').isDir).toBeFalsy()
        gl.clone_from(projdir._abspath)
        expect(gl.is_repo).toBeTruthy()
        expect(cloned_path.add('.git').isDir).toBeTruthy()
    })
})