import { Injectable } from '@nestjs/common';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  create(createUserDto: CreateUserDto) {
    // TODO: 实现创建用户逻辑
    // 使用 nanoId 生成 userId
    // 如果有密码，需要使用 argon2 进行哈希处理
    console.log('Creating user with data:', createUserDto);
    return 'This action adds a new user';
  }

  findAll() {
    // TODO: 实现查询所有用户逻辑
    return `This action returns all users`;
  }

  findOne(userId: string) {
    // TODO: 实现根据 userId 查询用户逻辑
    return `This action returns user #${userId}`;
  }

  findByEmail(email: string) {
    // TODO: 实现根据邮箱查询用户逻辑
    return `This action returns user with email: ${email}`;
  }

  findByGithubId(githubId: string) {
    // TODO: 实现根据 GitHub ID 查询用户逻辑
    return `This action returns user with github id: ${githubId}`;
  }

  update(userId: string, updateUserDto: UpdateUserDto) {
    // TODO: 实现更新用户逻辑
    console.log('Updating user with data:', updateUserDto);
    return `This action updates user #${userId}`;
  }

  updateLastLogin(userId: string) {
    // TODO: 实现更新用户最后登录时间逻辑
    return `This action updates last login time for user #${userId}`;
  }

  remove(userId: string) {
    // TODO: 实现删除用户逻辑
    return `This action removes user #${userId}`;
  }
}
